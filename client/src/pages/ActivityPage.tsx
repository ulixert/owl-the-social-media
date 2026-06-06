import { useEffect } from 'react';

import { Center, Stack, Text, ThemeIcon } from '@mantine/core';
import { useTitleStore } from '@stores/titleStore.ts';
import { IconBell } from '@tabler/icons-react';

// Placeholder until notifications (WebSocket) lands. The nav slot exists now so
// the layout is in place for that work.
export function ActivityPage() {
  const setTitle = useTitleStore((state) => state.setTitle);
  useEffect(() => {
    setTitle('Activity');
  }, [setTitle]);

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
          Likes, follows, and replies will show up here soon.
        </Text>
      </Stack>
    </Center>
  );
}
