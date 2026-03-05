import { useLocation } from 'react-router-dom';
import { PostType } from 'validation';

import { axiosInstance } from '@/api/axiosConfig.ts';
import { useAuthStore } from '@stores/authStore.ts';
import { useInfiniteQuery } from '@tanstack/react-query';

export type Post = PostType & {
  postedBy: {
    id: number;
    username: string;
    name: string;
    profilePic: string | null;
  };
  parentPost?: {
    postedBy: {
      username: string;
    };
  } | null;
  isLiked: boolean;
};

type PostsResponse = {
  posts: Post[];
  nextCursor: number | null;
};

export function usePosts(endpoint = location.pathname) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  const { data, isPending, isError, hasNextPage, fetchNextPage, isFetching } =
    useInfiniteQuery({
      queryKey: ['posts', isAuthenticated, location.pathname, endpoint],
      queryFn: async ({ pageParam }): Promise<PostsResponse> => {
        if (endpoint === '/') {
          endpoint = isAuthenticated ? '/for-you' : '/hot';
        }

        const response = await axiosInstance.get<PostsResponse>(
          `posts${endpoint}`,
          {
            params: {
              cursor: pageParam === 0 ? undefined : pageParam,
              limit: 10,
            },
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
