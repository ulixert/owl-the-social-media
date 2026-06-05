package owl.trending;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.functions.AggregateFunction;
import org.apache.flink.api.common.state.ListState;
import org.apache.flink.api.common.state.ListStateDescriptor;
import org.apache.flink.api.common.typeinfo.TypeHint;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.functions.KeyedProcessFunction;
import org.apache.flink.streaming.api.functions.windowing.ProcessWindowFunction;
import org.apache.flink.streaming.api.windowing.assigners.SlidingEventTimeWindows;
import org.apache.flink.streaming.api.windowing.time.Time;
import org.apache.flink.streaming.api.windowing.windows.TimeWindow;
import org.apache.flink.util.Collector;

/**
 * Trending posts via Flink: reads the Like CDC stream, counts likes per post in a
 * sliding <b>event-time</b> window, and (next commit) writes the top-K to Redis.
 *
 * <p>The event-time + watermark setup is the point of using Flink here: windows
 * are bucketed by each like's own timestamp and tolerate out-of-order/late events,
 * which a plain consumer can't do without reimplementing windowing by hand.
 */
public class TrendingJob {

  static String env(String key, String fallback) {
    String v = System.getenv(key);
    return (v == null || v.isBlank()) ? fallback : v;
  }

  static int envInt(String key, int fallback) {
    try {
      return Integer.parseInt(env(key, Integer.toString(fallback)));
    } catch (NumberFormatException e) {
      return fallback;
    }
  }

  public static void main(String[] args) throws Exception {
    final String brokers = env("KAFKA_BROKERS", "redpanda:9092");
    final String topic = env("LIKE_TOPIC", "owl.public.Like");
    final int windowMinutes = envInt("WINDOW_MINUTES", 60);
    final int slideMinutes = envInt("SLIDE_MINUTES", 1);
    final int latenessSeconds = envInt("LATENESS_SECONDS", 30);
    final int topK = envInt("TOP_K", 20);
    final String redisHost = env("REDIS_HOST", "redis");
    final int redisPort = envInt("REDIS_PORT", 6379);
    final String trendingKey = env("TRENDING_KEY", "trending");

    StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

    KafkaSource<String> source =
        KafkaSource.<String>builder()
            .setBootstrapServers(brokers)
            .setTopics(topic)
            .setGroupId("owl-trending")
            .setStartingOffsets(OffsetsInitializer.earliest())
            .setValueOnlyDeserializer(new NullableStringSchema())
            .build();

    final ObjectMapper mapper = new ObjectMapper();

    // Parse Debezium JSON → LikeEvent (drop non-like-given / malformed events).
    DataStream<LikeEvent> likes =
        env.fromSource(source, WatermarkStrategy.noWatermarks(), "likes")
            .flatMap(
                (String json, Collector<LikeEvent> out) -> {
                  LikeEvent e = LikeEvent.parse(json, mapper);
                  if (e != null) out.collect(e);
                })
            .returns(LikeEvent.class)
            // Event time = the like's createdAt; watermark allows bounded lateness.
            .assignTimestampsAndWatermarks(
                WatermarkStrategy.<LikeEvent>forBoundedOutOfOrderness(
                        Duration.ofSeconds(latenessSeconds))
                    .withTimestampAssigner((e, ts) -> e.eventTimeMs));

    // Per-post count over a sliding event-time window.
    DataStream<PostCount> perPost =
        likes
            .keyBy(e -> e.postId)
            .window(
                SlidingEventTimeWindows.of(
                    Time.minutes(windowMinutes), Time.minutes(slideMinutes)))
            .aggregate(new CountAggregate(), new EmitPostCount());

    // Top-K across posts per window: re-key by window end so every post's count
    // for the same window lands on one key, buffer them, and emit the ranked list
    // when the event-time watermark passes that window end.
    DataStream<List<PostCount>> topKStream =
        perPost
            .keyBy(pc -> pc.windowEnd)
            .process(new TopNFunction(topK))
            .returns(TypeInformation.of(new TypeHint<List<PostCount>>() {}));

    topKStream.addSink(new RedisTopKSink(redisHost, redisPort, trendingKey));

    env.execute("owl-trending");
  }

  /**
   * Windowed Top-N: buffers all per-post counts that share a window end, then on
   * the event-time timer for that window end emits the top-K by count. The timer
   * firing means the watermark has passed the window, so all counts have arrived.
   */
  static final class TopNFunction
      extends KeyedProcessFunction<Long, PostCount, List<PostCount>> {
    private final int k;
    private transient ListState<PostCount> buffer;

    TopNFunction(int k) {
      this.k = k;
    }

    @Override
    public void open(Configuration parameters) {
      buffer =
          getRuntimeContext()
              .getListState(new ListStateDescriptor<>("topn-buffer", PostCount.class));
    }

    @Override
    public void processElement(PostCount value, Context ctx, Collector<List<PostCount>> out)
        throws Exception {
      buffer.add(value);
      ctx.timerService().registerEventTimeTimer(value.windowEnd);
    }

    @Override
    public void onTimer(long timestamp, OnTimerContext ctx, Collector<List<PostCount>> out)
        throws Exception {
      List<PostCount> all = new ArrayList<>();
      buffer.get().forEach(all::add);
      buffer.clear();
      all.sort(Comparator.comparingLong((PostCount pc) -> pc.count).reversed());
      // A standalone ArrayList, not subList() — the latter is a view the
      // downstream operator's Kryo copy can't clone (ConcurrentModification/NPE).
      out.collect(new ArrayList<>(all.subList(0, Math.min(k, all.size()))));
    }
  }

  /** Counts events in a window. */
  static final class CountAggregate implements AggregateFunction<LikeEvent, Long, Long> {
    @Override public Long createAccumulator() { return 0L; }
    @Override public Long add(LikeEvent value, Long acc) { return acc + 1; }
    @Override public Long getResult(Long acc) { return acc; }
    @Override public Long merge(Long a, Long b) { return a + b; }
  }

  /** Attaches the post id and window end to the count. */
  static final class EmitPostCount
      extends ProcessWindowFunction<Long, PostCount, Integer, TimeWindow> {
    @Override
    public void process(Integer postId, Context ctx, Iterable<Long> counts, Collector<PostCount> out) {
      out.collect(new PostCount(postId, counts.iterator().next(), ctx.window().getEnd()));
    }
  }
}
