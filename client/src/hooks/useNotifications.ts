import { axiosInstance } from '@/api/axiosConfig.ts';
import {
  ClientNotification,
  notificationKeys,
} from '@/types/notification.ts';
import { useAuthStore } from '@stores/authStore.ts';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

type NotificationsResponse = {
  notifications: ClientNotification[];
  nextCursor: number | null;
};

const PAGE_SIZE = 20;

// The Activity feed: the current user's notifications, newest first, paginated
// by the keyset cursor the server returns.
export function useNotifications() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const query = useInfiniteQuery({
    queryKey: notificationKeys.list,
    enabled: isAuthenticated,
    queryFn: async ({ pageParam }): Promise<NotificationsResponse> => {
      const response = await axiosInstance.get<NotificationsResponse>(
        'notifications',
        {
          params: {
            cursor: pageParam === 0 ? undefined : pageParam,
            limit: PAGE_SIZE,
          },
        },
      );
      return response.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const notifications =
    query.data?.pages.flatMap((page) => page.notifications) ?? [];

  return {
    notifications,
    isPending: query.isPending,
    isError: query.isError,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  } as const;
}

// Unread total behind the Activity nav badge.
export function useUnreadCount() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: notificationKeys.unreadCount,
    enabled: isAuthenticated,
    queryFn: async (): Promise<number> => {
      const response = await axiosInstance.get<{ count: number }>(
        'notifications/unread-count',
      );
      return response.data.count;
    },
  });
}

// Mark all notifications read (on viewing the Activity page). Clears the badge
// immediately, then refetches both queries to reconcile.
export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await axiosInstance.post('notifications/read');
    },
    onSuccess: () => {
      queryClient.setQueryData(notificationKeys.unreadCount, 0);
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
