import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';

import { Loading } from '@/components/Loading/Loading.tsx';
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
    isFetching,
    isFetchingNextPage,
  } = usePosts(endpoint);
  const { ref, inView } = useInView();
  const location = useLocation();

  useEffect(() => {
    if (inView && hasNextPage) {
      void fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  if (isPending) {
    return <Loading />;
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

  // A full-feed refetch (e.g. clicking the active feed to reload) — show a small
  // spinner at the top while it's in flight, distinct from infinite-scroll.
  const isReloading = isFetching && !isFetchingNextPage;

  return (
    <Stack p="md" pb={0}>
      {isReloading && (
        <Center py={4}>
          <Loader size="sm" type="dots" />
        </Center>
      )}
      {data?.pages.map((page) =>
        page.posts.map((post) => <PostItem key={post.id} post={post} />),
      )}

      {hasNextPage && (
        <div ref={ref}>
          {isFetching && (
            <Center>
              <Loader type="bars" />
            </Center>
          )}
        </div>
      )}
    </Stack>
  );
}
