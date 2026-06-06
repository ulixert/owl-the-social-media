import { useEffect, useRef } from 'react';

import {
  ClientNotification,
  notificationKeys,
} from '@/types/notification.ts';
import { showInfoNotification } from '@/utils/showNotification.tsx';
import { useAuthStore } from '@stores/authStore.ts';
import { useQueryClient } from '@tanstack/react-query';

const API_PREFIX = import.meta.env.VITE_API_PREFIX as string;
const MAX_BACKOFF_MS = 30_000;

// Human-readable summary for the toast.
function describe(n: ClientNotification): string {
  switch (n.type) {
    case 'LIKE':
      return `${n.actor.name} liked your post`;
    case 'FOLLOW':
      return `${n.actor.name} followed you`;
    case 'REPLY':
      return `${n.actor.name} replied to your post`;
  }
}

// Holds one live notification WebSocket open while the user is authenticated.
// On each message we toast and invalidate the notification queries so the
// Activity list and the unread badge refetch; the socket is the "something
// changed" signal, the REST hooks own the data. Reconnects with exponential
// backoff; tears down on logout / token change. Mount once (in AppLayout).
export function useNotificationSocket() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const backoffRef = useRef(1000);

  useEffect(() => {
    if (!accessToken) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    // Set on cleanup so a deliberate close (logout/unmount) doesn't reconnect.
    let closed = false;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      // Same-origin so it rides the Vite dev proxy (and the prod reverse proxy).
      ws = new WebSocket(
        `${proto}://${window.location.host}${API_PREFIX}/ws?token=${accessToken}`,
      );

      ws.onopen = () => {
        backoffRef.current = 1000; // reset backoff on a healthy connection
      };

      ws.onmessage = (event) => {
        try {
          const notification = JSON.parse(
            event.data as string,
          ) as ClientNotification;
          showInfoNotification({
            title: 'New activity',
            message: describe(notification),
          });
        } catch {
          // Ignore malformed frames.
        }
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      };

      ws.onclose = () => {
        if (closed) return;
        reconnectTimer = setTimeout(connect, backoffRef.current);
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      };
    };

    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [accessToken, queryClient]);
}
