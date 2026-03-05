import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

import { Loading } from '@/components/Loading/Loading.tsx';
import { usePosts } from '@/hooks/usePosts.tsx';
import { Center, Loader, Stack } from '@mantine/core';

import { PostItem } from '../PostItem/PostItem.tsx';

type PostListProps = {
  endpoint?: string;
};

export function PostList({ endpoint }: PostListProps) {
  const { data, isPending, isError, hasNextPage, fetchNextPage, isFetching } =
    usePosts(endpoint);
  const { ref, inView } = useInView();

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

  return (
    <Stack p="md">
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
