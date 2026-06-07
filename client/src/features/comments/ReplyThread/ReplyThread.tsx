import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useChildPosts } from '@/hooks/useChildPosts.ts';
import { Post } from '@/hooks/usePosts.tsx';
import { Box, Center, Loader, Text, UnstyledButton } from '@mantine/core';

import { PostItem } from '../../posts/PostItem/PostItem.tsx';
import classes from './ReplyThread.module.css';

// How deep replies nest inline before the toggle navigates to the reply's own
// page instead (keeps very deep chains from running off the right edge).
const MAX_DEPTH = 4;

type ReplyThreadProps = {
  post: Post;
  depth?: number;
};

export function ReplyThread({ post, depth = 0 }: ReplyThreadProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const hasReplies = post.commentsCount > 0;
  const canExpandInline = hasReplies && depth < MAX_DEPTH;

  // Lazy: only fetch this reply's children once it's expanded.
  const { data, isFetching, hasNextPage, fetchNextPage } = useChildPosts(
    post.id,
    'recent',
    expanded && canExpandInline,
  );

  const count = post.commentsCount;
  const viewLabel = `View ${count} ${count === 1 ? 'reply' : 'replies'}`;

  return (
    <Box>
      <PostItem post={post} hideReplyContext hideDivider={depth > 0} />

      {hasReplies && (
        <UnstyledButton
          className={classes.toggle}
          onClick={() =>
            canExpandInline
              ? setExpanded((e) => !e)
              : void navigate(`/posts/${post.id}`)
          }
        >
          <Text size="sm" c="dimmed" fw={600}>
            {expanded && canExpandInline ? 'Hide replies' : viewLabel}
          </Text>
        </UnstyledButton>
      )}

      {expanded && canExpandInline && (
        <Box className={classes.nested}>
          {data?.pages.map((page) =>
            page.childPosts.map((child) => (
              <ReplyThread key={child.id} post={child} depth={depth + 1} />
            )),
          )}

          {isFetching && (
            <Center my="xs">
              <Loader size="sm" />
            </Center>
          )}

          {hasNextPage && (
            <UnstyledButton
              className={classes.toggle}
              onClick={() => void fetchNextPage()}
            >
              <Text size="sm" c="dimmed" fw={600}>
                Show more replies
              </Text>
            </UnstyledButton>
          )}
        </Box>
      )}
    </Box>
  );
}
