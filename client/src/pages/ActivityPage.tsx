import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { Loading } from '@/components/Loading/Loading.tsx';
import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import {
  useMarkAllRead,
  useNotifications,
  useUnreadCount,
} from '@/hooks/useNotifications.ts';
import { ClientNotification } from '@/types/notification.ts';
import { getPostTime } from '@/utils/getPostTime.ts';
import {
  Box,
  Button,
  Center,
  Group,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useTitleStore } from '@stores/titleStore.ts';
import { IconBell } from '@tabler/icons-react';

function describe(type: ClientNotification['type']): string {
  switch (type) {
    case 'LIKE':
      return 'liked your post';
    case 'FOLLOW':
      return 'followed you';
    case 'REPLY':
      return 'replied to your post';
  }
}

// Where a notification leads: a post for likes/replies, the actor's profile for
// a follow.
function targetHref(n: ClientNotification): string {
  if (n.post) return `/posts/${n.post.id}`;
  return `/user/${n.actor.username}`;
}

function NotificationRow({ n }: { n: ClientNotification }) {
  return (
    <Box
      component={Link}
      to={targetHref(n)}
      px="md"
      py="sm"
      bg={n.read ? undefined : 'var(--mantine-color-default-hover)'}
      style={{
        display: 'block',
        color: 'inherit',
        textDecoration: 'none',
        borderBottom: '1px solid var(--mantine-color-default-border)',
      }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <UserAvatar username={n.actor.username} avatar={n.actor.profilePic} />
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm">
            <Text span fw={700}>
              {n.actor.name}
            </Text>{' '}
            {describe(n.type)}
          </Text>
          {n.post?.text ? (
            <Text size="sm" c="dimmed" lineClamp={2}>
              {n.post.text}
            </Text>
          ) : null}
        </Box>
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {getPostTime(new Date(n.createdAt))}
        </Text>
      </Group>
    </Box>
  );
}

export function ActivityPage() {
  const setTitle = useTitleStore((state) => state.setTitle);
  const { notifications, isPending, isError, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const markAllRead = useMarkAllRead();

  useEffect(() => {
    setTitle('Activity');
  }, [setTitle]);

  // Viewing the page clears the unread badge.
  useEffect(() => {
    if (unreadCount && unreadCount > 0) markAllRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  if (isPending) return <Loading />;

  if (isError) {
    return (
      <Center mih="60vh" px="md">
        <Text c="dimmed">Could not load your activity. Try again later.</Text>
      </Center>
    );
  }

  if (notifications.length === 0) {
    return (
      <Center mih="60vh" px="md">
        <Stack align="center" gap="xs">
          <ThemeIcon variant="light" color="mono" size={56} radius="xl">
            <IconBell size={28} stroke={1.5} />
          </ThemeIcon>
          <Text fw={700} size="lg">
            Activity
          </Text>
          <Text c="dimmed" ta="center" maw={320}>
            Likes, follows, and replies will show up here.
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap={0}>
      {notifications.map((n) => (
        <NotificationRow key={n.id} n={n} />
      ))}
      {hasNextPage ? (
        <Center py="md">
          <Button
            variant="subtle"
            color="mono"
            onClick={() => void fetchNextPage()}
            loading={isFetchingNextPage}
          >
            Load more
          </Button>
        </Center>
      ) : null}
    </Stack>
  );
}
