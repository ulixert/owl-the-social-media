import { useLocation } from 'react-router-dom';

import { axiosInstance } from '@/api/axiosConfig.ts';
import { useInfiniteQuery } from '@tanstack/react-query';

import { Post } from './usePosts.tsx';

type ChildPostsResponse = {
  childPosts: Post[];
  nextCursor: number | null;
};

export type CommentSort = 'recent' | 'top';

export function useChildPosts(
  parentPostId: number,
  sort: CommentSort = 'recent',
) {
  const location = useLocation();

  const { data, isPending, isError, hasNextPage, fetchNextPage, isFetching } =
    useInfiniteQuery({
      queryKey: ['childPosts', location.pathname, parentPostId, sort],
      queryFn: async ({ pageParam }): Promise<ChildPostsResponse> => {
        const response = await axiosInstance.get<ChildPostsResponse>(
          `posts/${parentPostId}/comments`,
          {
            params: { cursor: pageParam == 0 ? undefined : pageParam, sort },
          },
        );

        return response.data;
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    });

  return {
    data,
    isPending,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetching,
  } as const;
}
