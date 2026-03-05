import { AuthResponse, axiosInstance } from '@/api/axiosConfig.ts';
import { useAuthStore } from '@stores/authStore.ts';

export async function refreshAccessToken() {
  try {
    const response = await axiosInstance.get<AuthResponse>(
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
