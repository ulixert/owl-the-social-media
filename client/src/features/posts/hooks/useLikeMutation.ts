import { axiosInstance } from '@/api/axiosConfig.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showErrorNotification } from '@/utils/showNotification.tsx';

export function useLikeMutation(postId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await axiosInstance.put(`/posts/${postId}/like`);
    },
    onSuccess: () => {
      // Invalidate posts queries to refresh liked status and counts
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
      void queryClient.invalidateQueries({ queryKey: ['post', postId] });
      void queryClient.invalidateQueries({ queryKey: ['childPosts'] });
    },
    onError: () => {
      showErrorNotification({
        title: 'Error',
        message: 'Could not like post.',
      });
    },
  });
}
