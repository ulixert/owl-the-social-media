package owl.trending;

import java.util.List;
import org.apache.flink.streaming.api.functions.sink.RichSinkFunction;
import redis.clients.jedis.JedisPool;
import redis.clients.jedis.Transaction;

/**
 * Writes each window's top-K posts into the Redis sorted set the API reads
 * (`trending`, member = postId, score = like count). Rebuilds the whole set per
 * window emission inside a MULTI/EXEC so a reader never sees a half-updated list.
 * This sink is the single writer of the key — same "derived view, single writer"
 * principle as the other views.
 */
public class RedisTopKSink extends RichSinkFunction<List<PostCount>> {
  private final String host;
  private final int port;
  private final String key;

  private transient JedisPool pool;

  public RedisTopKSink(String host, int port, String key) {
    this.host = host;
    this.port = port;
    this.key = key;
  }

  @Override
  public void open(org.apache.flink.configuration.Configuration parameters) {
    pool = new JedisPool(host, port);
  }

  @Override
  public void invoke(List<PostCount> topK, Context context) {
    if (topK.isEmpty()) return;
    try (var jedis = pool.getResource()) {
      Transaction tx = jedis.multi();
      tx.del(key);
      for (PostCount pc : topK) {
        tx.zadd(key, (double) pc.count, String.valueOf(pc.postId));
      }
      tx.exec();
    }
  }

  @Override
  public void close() {
    if (pool != null) pool.close();
  }
}
