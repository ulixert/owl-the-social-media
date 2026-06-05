import { refreshAccessToken } from '@/utils/refreshAccessToken.ts';
import { useAuthStore } from '@stores/authStore.ts';
import { useQuery } from '@tanstack/react-query';

const MINUTE = 1000 * 60;

// Restores the session on mount and proactively refreshes the access token on an
// interval. It goes through the shared single-flight `refreshAccessToken` rather
// than calling the endpoint directly, for two reasons:
//   1. refresh-token is POST (it rotates server state). Calling it as GET 404s,
//      which would clear the token and log the user out on every reload.
//   2. Concurrent refreshes (this hook + the axios 401 interceptor) would present
//      the same rotated-out token and trip reuse detection -> forced logout.
//      Single-flight collapses them into one in-flight request.
export function useAccessToken() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { isPending, isError } = useQuery({
    queryKey: ['accessToken'],
    queryFn: async () => {
      const token = await refreshAccessToken();
      if (!token) throw new Error('Not authenticated');
      return token;
    },
    retry: false,
    refetchInterval: () => (isAuthenticated ? 13 * MINUTE : false),
    refetchIntervalInBackground: true,
    gcTime: 15 * MINUTE,
    staleTime: 13 * MINUTE,
  });

  return { isPending, isError } as const;
}
