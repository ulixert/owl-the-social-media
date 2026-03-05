import { AuthResponse, axiosInstance } from '@/api/axiosConfig.ts';
import { useAuthStore } from '@stores/authStore.ts';
import { useQuery } from '@tanstack/react-query';

const MINUTE = 1000 * 60;

export function useAccessToken() {
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { isPending, isError } = useQuery({
    queryKey: ['accessToken'],
    queryFn: async () => {
      const response = await axiosInstance.get<AuthResponse>(
        '/auth/refresh-token',
      );
      const { accessToken, userId, username, name, profilePic } = response.data;

      if (accessToken) {
        setAccessToken(accessToken, {
          userId,
          username,
          name,
          profilePic,
        });
      }

      return response.data;
    },
    retry: false,
    refetchInterval: () => (isAuthenticated ? 13 * MINUTE : false),
    refetchIntervalInBackground: true,
    gcTime: 15 * MINUTE,
    staleTime: 13 * MINUTE,
  });

  return { isPending, isError } as const;
}
