import { axiosInstance } from '@/api/axiosConfig.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showErrorNotification } from '@/utils/showNotification.tsx';

export function useFollowMutation(userId: number, username: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await axiosInstance.put(`/users/follow/${userId}`);
    },
    onSuccess: () => {
      // Invalidate both the profile and any other queries that might depend on this
      void queryClient.invalidateQueries({ queryKey: ['userProfile', username] });
      // If we have a feed that shows follow status, we might need to invalidate that too
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: () => {
      showErrorNotification({
        title: 'Error',
        message: 'Could not update follow status.',
      });
    },
  });
}
