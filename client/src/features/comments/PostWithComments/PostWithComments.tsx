import { Fragment, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

import { usePostWithChildPosts } from '@/hooks/usePostWithChildPosts.ts';
import { Center, Divider, Loader, Stack } from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';

import { CreatePost } from '../../posts/CreatePost/CreatePost.tsx';
import { PostItem } from '../../posts/PostItem/PostItem.tsx';
import { OriginalPost } from '../OriginalPost/OriginalPost.tsx';

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
  );
}
