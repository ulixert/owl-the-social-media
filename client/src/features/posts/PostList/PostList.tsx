import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';

import { Loading } from '@/components/Loading/Loading.tsx';
import { useDelayedFlag } from '@/hooks/useDelayedFlag.ts';
import { usePosts } from '@/hooks/usePosts.tsx';
import { Center, Loader, Stack } from '@mantine/core';

import { FollowingEmpty } from '../FollowingEmpty/FollowingEmpty.tsx';
import { PostItem } from '../PostItem/PostItem.tsx';

type PostListProps = {
  endpoint?: string;
};

export function PostList({ endpoint }: PostListProps) {
  const {
    data,
    isPending,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePosts(endpoint);
  const { ref, inView } = useInView();
  const location = useLocation();

  // Only show the cold-load indicator if the fetch is slow enough to perceive,
  // so fast responses don't flash a spinner that vanishes a frame later.
  const showColdLoader = useDelayedFlag(isPending);

  useEffect(() => {
    if (inView && hasNextPage) {
      void fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  if (isPending) {
    return showColdLoader ? <Loading /> : null;
  }

  if (isError) {
    return <div>Error loading posts</div>;
  }

  // Empty Following timeline → suggest people to follow (keeps Following
  // chronological; discovery stays in Explore/For-You).
  const feed = endpoint ?? location.pathname;
  const isEmpty = !!data && data.pages.every((page) => page.posts.length === 0);
  if (isEmpty && feed === '/following') {
    return <FollowingEmpty />;
  }

  // A background refetch (clicking the active feed, or revisiting a tab after
  // it goes stale) keeps the existing posts on screen with no spinner — a
  // flash-and-gone indicator on an already-populated feed reads as a glitch.

  return (
    <Stack p="md" pb={0}>
      {(() => {
        const posts = data?.pages.flatMap((page) => page.posts) ?? [];
        return posts.map((post, i) => (
          <PostItem
            key={post.id}
            post={post}
            // No trailing divider on the final post (it would double up with the
            // card's bottom border).
            hideDivider={!hasNextPage && i === posts.length - 1}
          />
        ));
      })()}

      {hasNextPage && (
        <div ref={ref}>
          {isFetchingNextPage && (
            <Center>
              <Loader type="bars" />
            </Center>
          )}
        </div>
      )}
    </Stack>
  );
}
