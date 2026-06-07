import { useChildPosts } from '@/hooks/useChildPosts.ts';
import { Post } from '@/hooks/usePosts.tsx';
import { Box } from '@mantine/core';

import { PostItem } from '../../posts/PostItem/PostItem.tsx';
import classes from './ReplyThread.module.css';

// How deep replies nest inline before we stop recursing (guards against
// pathological depth; the seed threads are far shallower).
const MAX_DEPTH = 8;

type ReplyThreadProps = {
  post: Post;
  depth?: number;
};

// Renders a reply and, inline beneath it, its own reply — but only when it has
// exactly one (a linear continuation, Threads-style). A reply with zero or
// several replies isn't expanded here; you open it to see those.
export function ReplyThread({ post, depth = 0 }: ReplyThreadProps) {
  const hasSingleReply = post.commentsCount === 1 && depth < MAX_DEPTH;

  // Eagerly fetch the single continuation reply.
  const { data } = useChildPosts(post.id, 'recent', hasSingleReply);
  const children = data?.pages.flatMap((page) => page.childPosts) ?? [];

  return (
    <Box>
      <PostItem
        post={post}
        hideReplyContext
        hideDivider
        connectBottom={children.length > 0}
      />
      {children.length > 0 && (
        <Box className={classes.nested}>
          {children.map((child) => (
            <ReplyThread key={child.id} post={child} depth={depth + 1} />
          ))}
        </Box>
      )}
    </Box>
  );
}
