package owl.trending;

import java.nio.charset.StandardCharsets;
import org.apache.flink.api.common.serialization.DeserializationSchema;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.api.common.typeinfo.Types;

/**
 * Like {@code SimpleStringSchema} but tolerant of null Kafka values. Debezium
 * emits tombstone records (null value) after deletes for log compaction, and
 * {@code SimpleStringSchema} NPEs on those. Returning null here makes Flink's
 * default collector skip the record instead of crashing the job.
 */
public class NullableStringSchema implements DeserializationSchema<String> {
  @Override
  public String deserialize(byte[] message) {
    return message == null ? null : new String(message, StandardCharsets.UTF_8);
  }

  @Override
  public boolean isEndOfStream(String nextElement) {
    return false;
  }

  @Override
  public TypeInformation<String> getProducedType() {
    return Types.STRING;
  }
}
