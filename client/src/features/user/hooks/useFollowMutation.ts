import { axiosInstance } from '@/api/axiosConfig.ts';
import { FOLLOWING_IDS_KEY } from '@/hooks/useFollowingIds.ts';
import { showErrorNotification } from '@/utils/showNotification.tsx';
import { useFollowBadgeStore } from '@stores/followBadgeStore.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useFollowMutation(
  userId: number,
  username: string,
  isFollowing: boolean,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await axiosInstance.put(`/users/follow/${userId}`);
    },
    onSuccess: async () => {
      const nowFollowing = !isFollowing;

      // Patch the cached following-ids list and the session badge state so
      // avatar badges flip instantly — no need to refetch the whole feed
      // (which is what made the page "reload" on every follow).
      queryClient.setQueryData<number[]>(FOLLOWING_IDS_KEY, (ids = []) =>
        nowFollowing
          ? ids.includes(userId)
            ? ids
            : [...ids, userId]
          : ids.filter((id) => id !== userId),
      );
      const badge = useFollowBadgeStore.getState();
      if (nowFollowing) badge.markFollowed(userId);
      else badge.markUnfollowed(userId);

      // Light, targeted refreshes for surfaces that read follow state from their
      // own queries (the profile/hover card and the search list). The feed
      // (['posts']) is deliberately not invalidated.
      await queryClient.invalidateQueries({
        queryKey: ['userProfile', username],
      });
      await queryClient.invalidateQueries({ queryKey: ['search'] });
    },
    onError: () => {
      showErrorNotification({
        title: 'Error',
        message: 'Could not update follow status.',
      });
    },
  });
}
