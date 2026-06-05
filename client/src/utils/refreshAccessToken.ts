import { AuthResponse, axiosInstance } from '@/api/axiosConfig.ts';
import { useAuthStore } from '@stores/authStore.ts';

// Single-flight: refresh tokens now rotate on the server, so two concurrent
// refreshes would present the same (now-stale-after-the-first) token and trip
// reuse detection — logging the user out. Share one in-flight refresh instead.
let inFlight: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  try {
    // POST: refresh rotates server state (issues a new refresh cookie).
    const response = await axiosInstance.post<AuthResponse>(
      '/auth/refresh-token',
    );

    const { accessToken, userId, username, name, profilePic } = response.data;

    useAuthStore
      .getState()
      .setAccessToken(accessToken, { username, userId, name, profilePic });
    return accessToken;
  } catch {
    useAuthStore.getState().setAccessToken(null);
    return null;
  }
}

export function refreshAccessToken(): Promise<string | null> {
  inFlight ??= doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
