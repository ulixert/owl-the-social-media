import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

        {isAuthenticated && currentPost && (
          <CreatePost
            parentPost={currentPost.post}
            onExpand={() => openCreatePostModal(currentPost.post)}
          />
        )}

        {/* Sort control — only meaningful once there are replies. */}
        {currentPost && currentPost.post.commentsCount > 0 && (
          <>
            <Group justify="space-between" align="center">
              <Menu position="bottom-start" width={160}>
                <Menu.Target>
                  <UnstyledButton>
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
                  <Menu.Item onClick={() => setSort('recent')}>
                    Recent
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
            <Divider mx={-16} />
          </>
        )}

        {/* Render Child Posts. A reply with its own replies gets a connector
            stub to signal the sub-thread. */}
        {childPostsData?.pages.map((page) =>
          page.childPosts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              hideReplyContext
              connectBottom={post.commentsCount > 0}
            />
          )),
        )}

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
