// Shared shapes for serializing posts in feed/list responses. Lives in its own
// module so the controllers, the trending view, and the For-You feed can all
// reuse it without importing each other (avoids circular imports).

// Include shape for feed posts: author summary, parent author (for reply
// context), and the viewer's own like/repost rows (to derive isLiked/isReposted).
export function feedInclude(viewerId: number | undefined) {
  return {
    postedBy: { select: { id: true, username: true, name: true, profilePic: true } },
    parentPost: { select: { postedBy: { select: { username: true } } } },
    likes: viewerId ? { where: { userId: viewerId } } : undefined,
    reposts: viewerId ? { where: { userId: viewerId } } : undefined,
  };
}

// Strips the viewer's like/repost rows and turns them into booleans. (Kept the
// name for its callers; it now derives isReposted alongside isLiked.)
export function withIsLiked<T extends { likes?: unknown[]; reposts?: unknown[] }>(
  post: T,
) {
  const { likes, reposts, ...rest } = post;
  return {
    ...rest,
    isLiked: likes ? likes.length > 0 : false,
    isReposted: reposts ? reposts.length > 0 : false,
  };
}
