import { axiosInstance } from '@/api/axiosConfig.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showErrorNotification } from '@/utils/showNotification.tsx';

import {
  applyOptimisticToggle,
  likeUpdater,
  rollbackEngagement,
  type EngagementSnapshot,
} from './optimisticEngagement.ts';

export function useLikeMutation(postId: number) {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, void, { snapshot: EngagementSnapshot }>({
    mutationFn: async () => {
      await axiosInstance.put(`/posts/${postId}/like`);
    },
    // Flip the cached post immediately for instant feedback. We deliberately
    // don't invalidate the feed afterward: it caused a full reload, and the
    // CDC-derived like count is eventually consistent — refetching now would
    // briefly show the stale value. It reconciles on the next natural refetch.
    onMutate: async () => {
      const snapshot = await applyOptimisticToggle(
        queryClient,
        postId,
        likeUpdater,
      );
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context) rollbackEngagement(queryClient, context.snapshot);
      showErrorNotification({
        title: 'Error',
        message: 'Could not like post.',
      });
    },
  });
}
