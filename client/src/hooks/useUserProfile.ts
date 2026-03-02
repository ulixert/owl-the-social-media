import { axiosInstance } from '@/api/axiosConfig.ts';
import { useQuery } from '@tanstack/react-query';

export type UserProfile = {
  id: number;
  username: string;
  name: string;
  profilePic: string | null;
  biography: string | null;
  followingCount: number;
  followersCount: number;
  createdAt: string; // JSON from API
};

export type UserProfileResponse = { user: UserProfile };

async function fetchUserProfile(username: string) {
  const { data } = await axiosInstance.get<UserProfileResponse>(
    `/users/${username}`,
  );
  return data.user;
}

export function useUserProfile(username: string | undefined) {
  return useQuery({
    queryKey: ['userProfile', username],
    queryFn: () => fetchUserProfile(username!),
    enabled: Boolean(username),
    staleTime: 30_000,
  });
}
