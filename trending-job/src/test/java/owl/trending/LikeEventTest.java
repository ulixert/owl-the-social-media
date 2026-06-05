package owl.trending;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class LikeEventTest {
  private final ObjectMapper mapper = new ObjectMapper();

  @Test
  void parsesACreateWithMillisecondCreatedAt() {
    String json = "{\"op\":\"c\",\"after\":{\"postId\":42,\"createdAt\":1735689600000}}";
    LikeEvent e = LikeEvent.parse(json, mapper);
    assertEquals(42, e.postId);
    assertEquals(1735689600000L, e.eventTimeMs);
  }

  @Test
  void normalisesMicrosecondCreatedAtToMillis() {
    // Debezium MicroTimestamp (precision > 3) → epoch microseconds.
    String json = "{\"op\":\"c\",\"after\":{\"postId\":7,\"createdAt\":1735689600000000}}";
    LikeEvent e = LikeEvent.parse(json, mapper);
    assertEquals(1735689600000L, e.eventTimeMs);
  }

  @Test
  void fallsBackToTsMsWhenCreatedAtMissing() {
    String json = "{\"op\":\"c\",\"after\":{\"postId\":9},\"ts_ms\":1735689600123}";
    LikeEvent e = LikeEvent.parse(json, mapper);
    assertEquals(9, e.postId);
    assertEquals(1735689600123L, e.eventTimeMs);
  }

  @Test
  void ignoresUpdatesDeletesAndMalformed() {
    assertNull(LikeEvent.parse("{\"op\":\"u\",\"after\":{\"postId\":1,\"createdAt\":1}}", mapper));
    assertNull(LikeEvent.parse("{\"op\":\"d\",\"before\":{\"postId\":1}}", mapper));
    assertNull(LikeEvent.parse("{\"op\":\"c\",\"after\":{\"createdAt\":1}}", mapper)); // no postId
    assertNull(LikeEvent.parse("not json", mapper));
  }
}
