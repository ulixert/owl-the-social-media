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
  isReposted: boolean;
};

type PostsResponse = {
  posts: Post[];
  nextCursor: number | null;
};

export function usePosts(endpointArg?: string) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();
  // Resolve in the body, not a default param: a default `= location.pathname`
  // references the `location` const below, which is a TDZ hazard the bundler
  // resolved to undefined (→ requests to "postsundefined").
  const endpoint = endpointArg ?? location.pathname;

  const {
    data,
    isPending,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery({
      queryKey: ['posts', isAuthenticated, location.pathname, endpoint],
      queryFn: async ({ pageParam }): Promise<PostsResponse> => {
        const resolvedEndpoint =
          endpoint === '/'
            ? isAuthenticated
              ? '/for-you'
              : '/hot'
            : endpoint;

        const response = await axiosInstance.get<PostsResponse>(
          `posts${resolvedEndpoint}`,
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
      // Keep a recently-loaded feed "fresh" so navigating back to it shows the
      // cached page instantly (no refetch/loader). An explicit reload — clicking
      // the active feed — invalidates and refetches regardless of this.
      staleTime: 60_000,
    });

  return {
    data,
    isPending,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetching,
    isFetchingNextPage,
  } as const;
}
