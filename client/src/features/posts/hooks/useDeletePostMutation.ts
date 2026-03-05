import { useLocation, useNavigate } from 'react-router-dom';

import { axiosInstance } from '@/api/axiosConfig.ts';
import {
  showErrorNotification,
  showSuccessNotification,
} from '@/utils/showNotification.tsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useDeletePostMutation(postId: number) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  return useMutation({
    mutationFn: async () => {
      await axiosInstance.delete(`/posts/${postId}`);
    },
    onSuccess: async () => {
      showSuccessNotification({
        title: 'Post deleted',
        message: 'Your post has been successfully deleted.',
      });
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.invalidateQueries({ queryKey: ['search'] });

      // If we are on the post's detail page, navigate back
      if (location.pathname === `/posts/${postId}`) {
        void navigate(-1);
      }
    },
    onError: () => {
      showErrorNotification({
        title: 'Delete failed',
        message: 'Could not delete post. Please try again.',
      });
    },
  });
}
