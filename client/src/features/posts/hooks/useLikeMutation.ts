import { axiosInstance } from '@/api/axiosConfig.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showErrorNotification } from '@/utils/showNotification.tsx';

export function useLikeMutation(postId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await axiosInstance.put(`/posts/${postId}/like`);
    },
    onSuccess: async () => {
      // Invalidate posts queries to refresh liked status and counts
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.invalidateQueries({ queryKey: ['post', postId] });
      await queryClient.invalidateQueries({ queryKey: ['childPosts'] });
      await queryClient.invalidateQueries({ queryKey: ['search'] });
    },
    onError: () => {
      showErrorNotification({
        title: 'Error',
        message: 'Could not like post.',
      });
    },
  });
}
