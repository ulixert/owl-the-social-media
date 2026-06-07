import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';

import { CommentSort } from '@/hooks/useChildPosts.ts';
import { usePostWithChildPosts } from '@/hooks/usePostWithChildPosts.ts';
import {
  Center,
  Divider,
  Group,
  Loader,
  Menu,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';
import { IconArrowsSort, IconChevronDown } from '@tabler/icons-react';

import { useCreatePostModal } from '../../posts/hooks/useCreatePostModal.tsx';
import { CreatePost } from '../../posts/CreatePost/CreatePost.tsx';
import { PostItem } from '../../posts/PostItem/PostItem.tsx';
import { OriginalPost } from '../OriginalPost/OriginalPost.tsx';
import { ReplyThread } from '../ReplyThread/ReplyThread.tsx';
import classes from './PostWithComments.module.css';

const SORT_LABELS: Record<CommentSort, string> = {
  recent: 'Recent',
  top: 'Top',
};

export function PostWithComments() {
  const [sort, setSort] = useState<CommentSort>('recent');
  const {
    currentPost,
    ancestors,
    isLoading,
    isError,
    childPostsData,
    isChildFetching,
    isChildError,
    hasNextPage,
    fetchNextPage,
  } = usePostWithChildPosts(sort);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { openCreatePostModal } = useCreatePostModal();

  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView && hasNextPage) {
      void fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  // Pin the focused post to the top of the column when it has parents, so the
  // ancestor chain sits above it and is revealed by scrolling up (Threads-style).
  const focusedPostId = currentPost?.post.id;
  const threadRef = useRef<HTMLDivElement>(null);
  const hasAncestors = ancestors.length > 0;
  useLayoutEffect(() => {
    if (hasAncestors) {
      threadRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [focusedPostId, hasAncestors]);

  if (isLoading) {
    return (
      <Center mt="xl">
        <Loader />
      </Center>
    );
  }

  if (isError) {
    return <div>Error loading post</div>;
  }

  return (
    <Stack p="md" pb={0} gap={0}>
      {/* Ancestor chain, root-first, connected to the focused post by the
          thread line (rendered flush, no dividers). */}
      {ancestors.map((ancestor) => (
        <PostItem
          key={ancestor.id}
          post={ancestor}
          hideReplyContext
          connectBottom
          hideDivider
        />
      ))}

      {/* Focused post + replies. Given its own min-height so it can always be
          scrolled up to the top when there are parents above. */}
      <Stack
        ref={threadRef}
        gap="md"
        className={hasAncestors ? classes.thread : undefined}
      >
        {currentPost && (
          <OriginalPost post={currentPost.post} hideReplyContext={hasAncestors} />
        )}

        <Divider mx={-16} />

        {/* Row above the composer: sort control when there are replies,
            otherwise "No replies yet" (Threads-style). */}
        {currentPost &&
          (currentPost.post.commentsCount > 0 ? (
            <Menu position="bottom-start" width={160}>
              <Menu.Target>
                <UnstyledButton w="fit-content">
                  <Group gap={6}>
                    <IconArrowsSort size={16} />
                    <Text size="sm" fw={600}>
                      {SORT_LABELS[sort]}
                    </Text>
                    <IconChevronDown size={14} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => setSort('top')}>Top</Menu.Item>
                <Menu.Item onClick={() => setSort('recent')}>Recent</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Text c="dimmed" size="sm" fw={600}>
              No replies yet
            </Text>
          ))}

        {isAuthenticated && currentPost && (
          <CreatePost
            parentPost={currentPost.post}
            onExpand={() => openCreatePostModal(currentPost.post)}
          />
        )}

        {currentPost && currentPost.post.commentsCount > 0 && (
          <Divider mx={-16} />
        )}

        {/* Replies — a divider separates each top-level reply; a single-reply
            chain stays connected by the thread line (no divider within it). */}
        <Stack gap={0}>
          {childPostsData?.pages
            .flatMap((page) => page.childPosts)
            .map((post, i) => (
              <Fragment key={post.id}>
                {i > 0 && <Divider mx={-16} />}
                <ReplyThread post={post} />
              </Fragment>
            ))}
        </Stack>

        {/* Infinite Scroll Loader */}
        {hasNextPage && (
          <div ref={ref}>
            {isChildFetching && (
              <Center>
                <Loader />
              </Center>
            )}
          </div>
        )}

        {/* Error Handling for Child Posts */}
        {isChildError && <div>Error loading child posts</div>}
      </Stack>
    </Stack>
  );
}
