import { axiosInstance } from '@/api/axiosConfig.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showErrorNotification, showSuccessNotification } from '@/utils/showNotification.tsx';
import { UserUpdateSchema } from 'validation';
import { z } from 'zod';
import { useAuthStore } from '@stores/authStore.ts';

type UpdateProfileInput = z.infer<typeof UserUpdateSchema>;

export function useUpdateProfileMutation(username: string) {
  const queryClient = useQueryClient();
  const updateUserData = useAuthStore((s) => s.updateUserData);

  return useMutation({
    mutationFn: async (data: UpdateProfileInput) => {
      await axiosInstance.put('/users/me/profile', data);
      return data;
    },
    onSuccess: async (data) => {
      showSuccessNotification({
        title: 'Profile updated',
        message: 'Your profile has been successfully updated.',
      });

      // Update local auth store state
      updateUserData({
        name: data.name,
        profilePic: data.profilePic,
      });

      // Invalidate the specific user profile
      await queryClient.invalidateQueries({ queryKey: ['userProfile', username] });
      // Invalidate posts to update profile pics/names in the feed
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: () => {
      showErrorNotification({
        title: 'Update failed',
        message: 'Could not update profile. Please try again.',
      });
    },
  });
}
