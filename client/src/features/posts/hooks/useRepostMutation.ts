import { axiosInstance } from '@/api/axiosConfig.ts';
import { showErrorNotification } from '@/utils/showNotification.tsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useRepostMutation(postId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await axiosInstance.put(`/posts/${postId}/repost`);
    },
    onSuccess: async () => {
      // Refresh repost status + counts wherever the post appears.
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.invalidateQueries({ queryKey: ['post', postId] });
      await queryClient.invalidateQueries({ queryKey: ['childPosts'] });
      await queryClient.invalidateQueries({ queryKey: ['search'] });
    },
    onError: () => {
      showErrorNotification({
        title: 'Error',
        message: 'Could not repost.',
      });
    },
  });
}
