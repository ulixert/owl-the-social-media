import { useEffect } from 'react';

import { Center, Stack, Text, ThemeIcon } from '@mantine/core';
import { useTitleStore } from '@stores/titleStore.ts';
import { IconMail } from '@tabler/icons-react';

// Placeholder until real-time messaging (WebSocket) lands. The nav slot exists
// now so the layout is in place for that work.
export function MessagesPage() {
  const setTitle = useTitleStore((state) => state.setTitle);
  useEffect(() => {
    setTitle('Messages');
  }, [setTitle]);

  return (
    <Center mih="60vh" px="md">
      <Stack align="center" gap="xs">
        <ThemeIcon variant="light" color="mono" size={56} radius="xl">
          <IconMail size={28} stroke={1.5} />
        </ThemeIcon>
        <Text fw={700} size="lg">
          Messages
        </Text>
        <Text c="dimmed" ta="center" maw={320}>
          Direct messages are coming soon.
        </Text>
      </Stack>
    </Center>
  );
}
