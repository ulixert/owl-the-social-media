import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { axiosInstance } from '@/api/axiosConfig.ts';
import { SearchUser, UserItem } from '@/features/user/UserItem/UserItem.tsx';
import { Box, Button, Stack, Text } from '@mantine/core';

type RecommendedResponse = { users: SearchUser[] };

// Shown when the Following timeline is empty (a new user, or one who follows
// nobody). Keeps Following purely chronological — discovery lives in Explore —
// while giving a dead feed a useful next step: people to follow.
export function FollowingEmpty() {
  const { data } = useQuery({
    queryKey: ['recommendedUsers'],
    queryFn: async () =>
      (await axiosInstance.get<RecommendedResponse>('users/recommended')).data,
  });

  return (
    <Stack p="md" gap="lg">
      <Stack gap={6} ta="center" mt="xl">
        <Text fw={700} size="lg">
          Your timeline is empty
        </Text>
        <Text c="dimmed" size="sm">
          Follow people to see their posts here — or head to Explore to see
          what&apos;s popular right now.
        </Text>
        <Box mt="xs">
          <Button component={Link} to="/search" radius="xl" variant="default">
            Go to Explore
          </Button>
        </Box>
      </Stack>

      {(data?.users.length ?? 0) > 0 && (
        <Box>
          <Text fw={700} size="sm" c="dimmed" mb="xs">
            Suggested for you
          </Text>
          {data?.users.slice(0, 5).map((user) => (
            <UserItem key={user.id} user={user} />
          ))}
        </Box>
      )}
    </Stack>
  );
}
