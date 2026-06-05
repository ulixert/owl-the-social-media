package owl.trending;

/** Likes for one post within one window (the per-post windowed aggregate). */
public final class PostCount {
  public int postId;
  public long count;
  public long windowEnd;

  public PostCount() {} // Flink POJO serialization needs a no-arg constructor

  public PostCount(int postId, long count, long windowEnd) {
    this.postId = postId;
    this.count = count;
    this.windowEnd = windowEnd;
  }

  @Override
  public String toString() {
    return "PostCount{post=" + postId + ", count=" + count + ", windowEnd=" + windowEnd + "}";
  }
}
