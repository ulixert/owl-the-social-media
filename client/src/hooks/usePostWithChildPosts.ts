import { useLocation } from 'react-router-dom';

import { axiosInstance } from '@/api/axiosConfig.ts';
import { useQuery } from '@tanstack/react-query';

import { useChildPosts } from './useChildPosts';
import { Post } from './usePosts.tsx';

type PostResponse = {
  post: Post;
};

export function usePostWithChildPosts() {
  const location = useLocation();
  const postId = Number(location.pathname.split('/').pop());

  // Fetch the current post (which might be a parent or a child)
  const {
    data: currentPostData,
    isLoading: isCurrentLoading,
    isError: isCurrentError,
  } = useQuery<PostResponse>({
    queryKey: ['post', postId],
    queryFn: async () => {
      const response = await axiosInstance.get<PostResponse>(`posts/${postId}`);
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const parentPostId = currentPostData?.post.parentPostId;

  // Fetch the actual parent post if the current post is a reply
  const {
    data: parentPostData,
    isLoading: isParentLoading,
    isError: isParentError,
  } = useQuery<PostResponse>({
    queryKey: ['post', parentPostId],
    queryFn: async () => {
      const response = await axiosInstance.get<PostResponse>(
        `posts/${parentPostId}`,
      );
      return response.data;
    },
    enabled: !!parentPostId,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: childPostsData,
    isPending: isChildFetching,
    isError: isChildError,
    hasNextPage,
    fetchNextPage,
  } = useChildPosts(postId);

  return {
    currentPost: currentPostData,
    parentPost: parentPostData,
    isParentLoading: isCurrentLoading || (!!parentPostId && isParentLoading),
    isParentError: isCurrentError || isParentError,
    childPostsData,
    isChildFetching,
    isChildError,
    hasNextPage,
    fetchNextPage,
  } as const;
}
