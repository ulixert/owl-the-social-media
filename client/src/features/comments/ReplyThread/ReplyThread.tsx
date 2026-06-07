import { useChildPosts } from '@/hooks/useChildPosts.ts';
import { Post } from '@/hooks/usePosts.tsx';

import { PostItem } from '../../posts/PostItem/PostItem.tsx';

// How deep a single-reply chain nests before we stop (guards against
// pathological depth; the seed threads are far shallower).
const MAX_DEPTH = 12;

type ReplyThreadProps = {
  post: Post;
  depth?: number;
};

// A reply and — only when it has exactly one reply — that reply directly below
// it, connected by the avatar-column thread line (a linear continuation,
// Threads-style). Replies with zero or several replies aren't expanded here.
export function ReplyThread({ post, depth = 0 }: ReplyThreadProps) {
  const hasSingleReply = post.commentsCount === 1 && depth < MAX_DEPTH;

  const { data } = useChildPosts(post.id, 'recent', hasSingleReply);
  const child = data?.pages.flatMap((page) => page.childPosts)[0];

  if (hasSingleReply && child) {
    return (
      <>
        <PostItem post={post} hideReplyContext hideDivider connectBottom />
        <ReplyThread post={child} depth={depth + 1} />
      </>
    );
  }

  return <PostItem post={post} hideReplyContext hideDivider />;
}
