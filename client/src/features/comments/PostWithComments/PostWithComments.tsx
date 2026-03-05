import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

import { usePostWithChildPosts } from '@/hooks/usePostWithChildPosts.ts';
import { Center, Divider, Loader, Stack } from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';

import { CreatePost } from '../../posts/CreatePost/CreatePost.tsx';
import { PostItem } from '../../posts/PostItem/PostItem.tsx';
import { OriginalPost } from '../OriginalPost/OriginalPost.tsx';

export function PostWithComments() {
  const {
    parentPost,
    isParentLoading,
    isParentError,
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

  if (isParentLoading) {
    return <Loader />;
  }

  if (isParentError) {
    return <div>Error loading parent post</div>;
  }

  return (
    <Stack>
      {parentPost && <OriginalPost post={parentPost.post} />}

      <Divider mx={-16} />

      {isAuthenticated && parentPost && (
        <CreatePost parentPost={parentPost.post} />
      )}

      {/* Render Child Posts */}
      {childPostsData?.pages.map((page) =>
        page.childPosts.map((post) => <PostItem key={post.id} post={post} />),
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
