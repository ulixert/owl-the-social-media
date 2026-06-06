// The wire shape produced by the server's serializeNotification (REST list and
// the live WebSocket payload are identical).
export type NotificationType = 'LIKE' | 'FOLLOW' | 'REPLY';

export type ClientNotification = {
  id: number;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actor: {
    id: number;
    username: string;
    name: string;
    profilePic: string | null;
  };
  post: { id: number; text: string | null } | null;
};

// Shared React Query keys so the socket hook and the data hooks stay in sync.
export const notificationKeys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};
