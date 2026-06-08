import { axiosInstance } from '@/api/axiosConfig.ts';
import { showErrorNotification } from '@/utils/showNotification.tsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  applyOptimisticToggle,
  repostUpdater,
  rollbackEngagement,
  type EngagementSnapshot,
} from './optimisticEngagement.ts';

export function useRepostMutation(postId: number) {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, void, { snapshot: EngagementSnapshot }>({
    mutationFn: async () => {
      await axiosInstance.put(`/posts/${postId}/repost`);
    },
    // Flip the cached post immediately (instant feedback, no feed reload).
    // repostsCount is authoritative in the DB, so the optimistic value matches
    // what a later refetch returns.
    onMutate: async () => {
      const snapshot = await applyOptimisticToggle(
        queryClient,
        postId,
        repostUpdater,
      );
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context) rollbackEngagement(queryClient, context.snapshot);
      showErrorNotification({
        title: 'Error',
        message: 'Could not repost.',
      });
    },
  });
}
