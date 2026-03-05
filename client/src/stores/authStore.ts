import { create } from 'zustand';

type UserData = {
  userId: number;
  username: string;
  name: string;
  profilePic: string | null;
};

type AuthState = {
  accessToken: string | null;
  userData: UserData | null;
  isAuthenticated: boolean;
  setAccessToken: (token: string | null, userData?: UserData | null) => void;
  updateUserData: (data: Partial<UserData>) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  isAuthenticated: false,
  userData: null,

  setAccessToken: (token, userData = null) =>
    set({
      accessToken: token,
      isAuthenticated: Boolean(token),
      userData,
    }),

  updateUserData: (data) =>
    set((state) => ({
      userData: state.userData ? { ...state.userData, ...data } : null,
    })),
}));
