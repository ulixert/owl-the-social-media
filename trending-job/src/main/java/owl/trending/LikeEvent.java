package owl.trending;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * A "like was given" event, parsed from a Debezium {@code owl.public.Like} change
 * event (JSON, schemas off). Pure and self-contained so it can be unit-tested
 * without a Kafka or Flink runtime.
 *
 * <p>We keep only creates ({@code op} c = live insert, r = snapshot read) — those
 * are likes given. Updates/deletes return {@code null} (an unlike would decrement,
 * a noted refinement that needs the unlike's commit time as its event time).
 */
public final class LikeEvent {
  public final int postId;
  public final long eventTimeMs;

  public LikeEvent(int postId, long eventTimeMs) {
    this.postId = postId;
    this.eventTimeMs = eventTimeMs;
  }

  /** @return the parsed event, or null if it isn't a like-given event we count. */
  public static LikeEvent parse(String json, ObjectMapper mapper) {
    try {
      JsonNode root = mapper.readTree(json);
      String op = root.path("op").asText(null);
      if (!"c".equals(op) && !"r".equals(op)) return null;

      JsonNode after = root.get("after");
      if (after == null || !after.hasNonNull("postId")) return null;
      int postId = after.get("postId").asInt();

      long eventTimeMs = extractEventTimeMs(after, root);
      if (eventTimeMs <= 0) return null;

      return new LikeEvent(postId, eventTimeMs);
    } catch (Exception e) {
      return null; // malformed payload — skip it
    }
  }

  /**
   * Event time = the like's own {@code createdAt}. Debezium encodes a Postgres
   * {@code timestamp} as an epoch integer whose unit depends on column precision
   * (≤3 → milliseconds, >3 → microseconds), so we normalise by magnitude. Falls
   * back to the envelope {@code ts_ms} (always milliseconds) if absent.
   */
  static long extractEventTimeMs(JsonNode after, JsonNode root) {
    if (after.hasNonNull("createdAt")) {
      long raw = after.get("createdAt").asLong();
      // ~1e12 in ms vs ~1e15 in µs for current dates: split at 1e14.
      return raw > 100_000_000_000_000L ? raw / 1000 : raw;
    }
    return root.path("ts_ms").asLong(0);
  }
}
