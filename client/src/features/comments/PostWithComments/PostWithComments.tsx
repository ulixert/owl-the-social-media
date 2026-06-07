import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';

import { usePostWithChildPosts } from '@/hooks/usePostWithChildPosts.ts';
import { Center, Divider, Loader, Stack } from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';

import { CreatePost } from '../../posts/CreatePost/CreatePost.tsx';
import { PostItem } from '../../posts/PostItem/PostItem.tsx';
import { OriginalPost } from '../OriginalPost/OriginalPost.tsx';
import classes from './PostWithComments.module.css';

export function PostWithComments() {
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
  } = usePostWithChildPosts();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

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
    <Stack p="md" pb={0}>
      {/* Ancestor chain, root-first, above the focused post. */}
      {ancestors.map((ancestor) => (
        <Fragment key={ancestor.id}>
          <OriginalPost post={ancestor} />
          <Divider mx={-16} />
        </Fragment>
      ))}

      {/* Focused post + replies. Given its own min-height so it can always be
          scrolled up to the top when there are parents above. */}
      <Stack
        ref={threadRef}
        gap="md"
        className={hasAncestors ? classes.thread : undefined}
      >
        {currentPost && <OriginalPost post={currentPost.post} />}

        <Divider mx={-16} />

        {isAuthenticated && currentPost && (
          <CreatePost parentPost={currentPost.post} />
        )}

        {/* Render Child Posts */}
        {childPostsData?.pages.map((page) =>
          page.childPosts.map((post) => (
            <PostItem key={post.id} post={post} hideReplyContext />
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
