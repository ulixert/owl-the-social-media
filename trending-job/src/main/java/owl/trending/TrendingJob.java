package owl.trending;

import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.serialization.SimpleStringSchema;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;

/**
 * Trending posts via Flink: reads the Like CDC stream from Kafka and (in later
 * commits) computes the most-liked posts in a sliding event-time window, writing
 * the top-K to Redis.
 *
 * <p>This first cut just connects to the stream and prints, to prove the job
 * builds, submits, and reads from Redpanda inside the cluster.
 */
public class TrendingJob {

  static String env(String key, String fallback) {
    String v = System.getenv(key);
    return (v == null || v.isBlank()) ? fallback : v;
  }

  public static void main(String[] args) throws Exception {
    final String brokers = env("KAFKA_BROKERS", "redpanda:9092");
    final String topic = env("LIKE_TOPIC", "owl.public.Like");

    StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

    KafkaSource<String> source =
        KafkaSource.<String>builder()
            .setBootstrapServers(brokers)
            .setTopics(topic)
            .setGroupId("owl-trending")
            .setStartingOffsets(OffsetsInitializer.earliest())
            .setValueOnlyDeserializer(new SimpleStringSchema())
            .build();

    env.fromSource(source, WatermarkStrategy.noWatermarks(), "likes").print();

    env.execute("owl-trending");
  }
}
