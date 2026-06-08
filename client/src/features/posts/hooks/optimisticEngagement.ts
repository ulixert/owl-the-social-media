import type { Query, QueryClient } from '@tanstack/react-query';

import { Post } from '@/hooks/usePosts.tsx';

// Optimistic like/repost: flip the post in every cache it appears in so the UI
// updates the instant you click — no full-feed refetch (which caused the jarring
// reload) and no reading back the CDC-derived count before it's caught up.

type PostUpdater = (post: Post) => Post;

// Query keys whose cached data can contain Post objects we need to keep in sync.
const ENGAGEMENT_KEYS = ['posts', 'post', 'childPosts', 'search', 'postAncestors'];

const matchesEngagement = (query: Query): boolean => {
  const key = query.queryKey[0];
  return typeof key === 'string' && ENGAGEMENT_KEYS.includes(key);
};

// Apply `update` to any Post with the given id, across the cache shapes our
// queries use: infinite feeds ({ pages: [{ posts | childPosts }] }), the post
// detail ({ post }), and the ancestor chain ({ ancestors }).
function mapCached(data: unknown, postId: number, update: PostUpdater): unknown {
  if (!data || typeof data !== 'object') return data;
  const mapPost = (p: Post): Post => (p?.id === postId ? update(p) : p);

  const d = data as {
    pages?: { posts?: Post[]; childPosts?: Post[] }[];
    post?: Post;
    ancestors?: Post[];
  };

  if (Array.isArray(d.pages)) {
    return {
      ...d,
      pages: d.pages.map((page) =>
        Array.isArray(page?.posts)
          ? { ...page, posts: page.posts.map(mapPost) }
          : Array.isArray(page?.childPosts)
            ? { ...page, childPosts: page.childPosts.map(mapPost) }
            : page,
      ),
    };
  }
  if (d.post && typeof d.post === 'object') {
    return { ...d, post: mapPost(d.post) };
  }
  if (Array.isArray(d.ancestors)) {
    return { ...d, ancestors: d.ancestors.map(mapPost) };
  }
  return data;
}

export type EngagementSnapshot = [readonly unknown[], unknown][];

// Cancels in-flight engagement refetches, snapshots the affected caches (for
// rollback), and applies the optimistic change. Returns the snapshot.
export async function applyOptimisticToggle(
  queryClient: QueryClient,
  postId: number,
  update: PostUpdater,
): Promise<EngagementSnapshot> {
  const filters = { predicate: matchesEngagement };
  await queryClient.cancelQueries(filters);
  const previous = queryClient.getQueriesData(filters);
  queryClient.setQueriesData(filters, (data) => mapCached(data, postId, update));
  return previous;
}

export function rollbackEngagement(
  queryClient: QueryClient,
  snapshot: EngagementSnapshot,
): void {
  for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
}

export const likeUpdater: PostUpdater = (p) => ({
  ...p,
  isLiked: !p.isLiked,
  likesCount: Math.max(0, p.likesCount + (p.isLiked ? -1 : 1)),
});

export const repostUpdater: PostUpdater = (p) => ({
  ...p,
  isReposted: !p.isReposted,
  repostsCount: Math.max(0, p.repostsCount + (p.isReposted ? -1 : 1)),
});
