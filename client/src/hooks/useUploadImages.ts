import { axiosInstance } from '@/api/axiosConfig.ts';
import { useMutation } from '@tanstack/react-query';

type UploadResponse = {
  urls: string[];
};

// Uploads one or more image files to the server's storage backend and returns
// the public URLs to store on a post or profile. The backend (disk now, S3
// later) is invisible here — we just hand over bytes and get back URLs.
export function useUploadImages() {
  return useMutation({
    mutationFn: async (files: File[]): Promise<string[]> => {
      const formData = new FormData();
      for (const file of files) formData.append('files', file);

      const { data } = await axiosInstance.post<UploadResponse>(
        '/upload',
        formData,
      );
      return data.urls;
    },
  });
}
