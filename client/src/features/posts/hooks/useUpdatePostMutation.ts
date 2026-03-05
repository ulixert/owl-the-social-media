import { axiosInstance } from '@/api/axiosConfig.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showErrorNotification, showSuccessNotification } from '@/utils/showNotification.tsx';
import { PostUpdateSchema } from 'validation';
import { z } from 'zod';
import { Post } from '@/hooks/usePosts.tsx';

type UpdatePostInput = z.infer<typeof PostUpdateSchema>;

type UpdatePostResponse = {
  post: Post;
};

export function useUpdatePostMutation(postId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdatePostInput) => {
      const res = await axiosInstance.put<UpdatePostResponse>(`/posts/${postId}`, data);
      return res.data.post;
    },
    onSuccess: async () => {
      showSuccessNotification({
        title: 'Post updated',
        message: 'Your post has been successfully updated.',
      });
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.invalidateQueries({ queryKey: ['post', postId] });
      await queryClient.invalidateQueries({ queryKey: ['search'] });
    },
    onError: () => {
      showErrorNotification({
        title: 'Update failed',
        message: 'Could not update post. Please try again.',
      });
    },
  });
}
