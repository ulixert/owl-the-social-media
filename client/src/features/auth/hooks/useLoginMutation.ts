import { useNavigate } from 'react-router-dom';
import { LoginType } from 'validation';

import { AuthResponse, axiosInstance } from '@/api/axiosConfig.ts';
import { useAuthStore } from '@stores/authStore.ts';
import { useMutation } from '@tanstack/react-query';

export const useLoginMutation = () => {
  const navigate = useNavigate();
  const setAccessToken = useAuthStore((state) => state.setAccessToken);

  return useMutation({
    mutationFn: async (data: LoginType) => {
      const response = await axiosInstance.post('/auth/login', data);
      return response.data as AuthResponse;
    },
    onSuccess: ({ accessToken, userId, profilePic, username, name }) => {
      setAccessToken(accessToken, { userId, profilePic, username, name });
      void navigate('/');
    },
  });
};
