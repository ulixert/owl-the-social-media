import { axiosInstance } from '@/api/axiosConfig.ts';
import { useQuery } from '@tanstack/react-query';

import { Post } from './usePosts.tsx';

type AncestorsResponse = {
  ancestors: Post[];
};

// The ancestor chain above a post (root-first), rendered above the focused post
// on the detail page. Only fetched when the focused post is actually a reply.
export function usePostAncestors(postId: number, enabled: boolean) {
  return useQuery<AncestorsResponse>({
    queryKey: ['ancestors', postId],
    queryFn: async () => {
      const response = await axiosInstance.get<AncestorsResponse>(
        `posts/${postId}/ancestors`,
      );
      return response.data;
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}
