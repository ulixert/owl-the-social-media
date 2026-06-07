import { axiosInstance } from '@/api/axiosConfig.ts';
import { useAuthStore } from '@stores/authStore.ts';
import { useQuery } from '@tanstack/react-query';

export const FOLLOWING_IDS_KEY = ['followingIds'] as const;

// Ids of everyone the current user follows. Fetched once and kept in the cache;
// the follow mutation patches it directly so avatar badges update without
// refetching the feed.
export function useFollowingIds() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: FOLLOWING_IDS_KEY,
    queryFn: async () => {
      const { data } = await axiosInstance.get<{ ids: number[] }>(
        '/users/me/following',
      );
      return data.ids;
    },
    enabled: isAuthenticated,
    staleTime: Infinity,
  });
}
