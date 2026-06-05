// Shared shapes for serializing posts in feed/list responses. Lives in its own
// module so the controllers, the trending view, and the For-You feed can all
// reuse it without importing each other (avoids circular imports).

// Include shape for feed posts: author summary, parent author (for reply
// context), and the viewer's own like row (to derive isLiked).
export function feedInclude(viewerId: number | undefined) {
  return {
    postedBy: { select: { id: true, username: true, name: true, profilePic: true } },
    parentPost: { select: { postedBy: { select: { username: true } } } },
    likes: viewerId ? { where: { userId: viewerId } } : undefined,
  };
}

export function withIsLiked<T extends { likes?: unknown[] }>(post: T) {
  const { likes, ...rest } = post;
  return { ...rest, isLiked: likes ? likes.length > 0 : false };
}
