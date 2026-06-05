package owl.trending;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.functions.AggregateFunction;
import org.apache.flink.api.common.serialization.SimpleStringSchema;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.windowing.assigners.SlidingEventTimeWindows;
import org.apache.flink.streaming.api.windowing.time.Time;
import org.apache.flink.streaming.api.windowing.windows.TimeWindow;
import org.apache.flink.util.Collector;
import org.apache.flink.streaming.api.functions.windowing.ProcessWindowFunction;

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

    StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

    KafkaSource<String> source =
        KafkaSource.<String>builder()
            .setBootstrapServers(brokers)
            .setTopics(topic)
            .setGroupId("owl-trending")
            .setStartingOffsets(OffsetsInitializer.earliest())
            .setValueOnlyDeserializer(new SimpleStringSchema())
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

    perPost.print();

    env.execute("owl-trending");
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
