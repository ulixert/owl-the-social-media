import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import { Box, Button, Group, Text } from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';

import { useCreatePostModal } from '../hooks/useCreatePostModal.tsx';
import classes from './InlineComposer.module.css';

// Threads-style "What's new?" row at the top of the feed. Clicking anywhere on
// it opens the create-post modal. Hidden when logged out (nothing to post).
export function InlineComposer() {
  const userData = useAuthStore((s) => s.userData);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { openCreatePostModal } = useCreatePostModal();

  if (!isAuthenticated) return null;

  const open = () => openCreatePostModal();

  return (
    <Box className={classes.composer} onClick={open}>
      <Group gap="sm" wrap="nowrap">
        <UserAvatar
          username={userData?.username ?? 'You'}
          avatar={userData?.profilePic ?? null}
        />
        <Text c="dimmed" size="sm" style={{ flex: 1 }}>
          What&apos;s new?
        </Text>
        <Button
          radius="xl"
          size="compact-sm"
          color="mono"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
        >
          Post
        </Button>
      </Group>
    </Box>
  );
}
