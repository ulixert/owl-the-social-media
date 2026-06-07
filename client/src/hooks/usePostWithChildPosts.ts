import { useLocation } from 'react-router-dom';

import { axiosInstance } from '@/api/axiosConfig.ts';
import { useQuery } from '@tanstack/react-query';

import { CommentSort, useChildPosts } from './useChildPosts';
import { usePostAncestors } from './usePostAncestors';
import { Post } from './usePosts.tsx';

type PostResponse = {
  post: Post;
};

export function usePostWithChildPosts(sort: CommentSort = 'recent') {
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

  // Fetch the full ancestor chain (root-first) when the current post is a reply.
  const {
    data: ancestorsData,
    isLoading: isAncestorsLoading,
    isError: isAncestorsError,
  } = usePostAncestors(postId, !!parentPostId);

  const {
    data: childPostsData,
    isPending: isChildFetching,
    isError: isChildError,
    hasNextPage,
    fetchNextPage,
  } = useChildPosts(postId, sort);

  return {
    currentPost: currentPostData,
    ancestors: ancestorsData?.ancestors ?? [],
    isLoading: isCurrentLoading || (!!parentPostId && isAncestorsLoading),
    isError: isCurrentError || isAncestorsError,
    childPostsData,
    isChildFetching,
    isChildError,
    hasNextPage,
    fetchNextPage,
  } as const;
}
