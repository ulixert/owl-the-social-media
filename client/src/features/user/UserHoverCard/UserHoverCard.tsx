import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '@/hooks/useUserProfile.ts';
import { useAuthStore } from '@stores/authStore.ts';
import { useFollowMutation } from '../hooks/useFollowMutation.ts';
import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import {
  Box,
  Button,
  Flex,
  HoverCard,
  Loader,
  Stack,
  Text,
} from '@mantine/core';

type UserHoverCardProps = {
  username: string;
  children: React.ReactNode;
};

export function UserHoverCard({ username, children }: UserHoverCardProps) {
  const navigate = useNavigate();
  const { data: user, isLoading } = useUserProfile(username);
  const currentUser = useAuthStore((state) => state.userData);
  const followMutation = useFollowMutation(user?.id ?? 0, username);

  const isCurrentUser = currentUser?.userId === user?.id;

  const handleFollow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    followMutation.mutate();
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (user) {
      navigate(`/user/${user.username}`);
    }
  };

  return (
    <HoverCard width={300} shadow="xl" withArrow openDelay={200} radius="lg">
      <HoverCard.Target>{children}</HoverCard.Target>
      <HoverCard.Dropdown
        p="lg"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {isLoading || !user ? (
          <Flex justify="center" py="md">
            <Loader size="sm" color="gray" />
          </Flex>
        ) : (
          <Stack gap="md">
            <Flex justify="space-between" align="start">
              <Box onClick={handleProfileClick} style={{ cursor: 'pointer' }}>
                <UserAvatar
                  username={user.username}
                  avatar={user.profilePic}
                  size="xl"
                />
              </Box>
              {!isCurrentUser && (
                <Button
                  size="sm"
                  radius="md"
                  variant={user.isFollowing ? 'outline' : 'filled'}
                  color={user.isFollowing ? 'gray' : 'dark'}
                  onClick={handleFollow}
                  loading={followMutation.isPending}
                  fw={600}
                >
                  {user.isFollowing ? 'Following' : 'Follow'}
                </Button>
              )}
            </Flex>

            <Box onClick={handleProfileClick} style={{ cursor: 'pointer' }}>
              <Text fw={700} size="lg" lh={1.2}>
                {user.name || user.username}
              </Text>
              <Text size="sm" c="dimmed">
                @{user.username}
              </Text>
            </Box>

            {user.biography && (
              <Text size="sm" lineClamp={3}>
                {user.biography}
              </Text>
            )}

            <Flex gap="md">
              <Flex gap={4} align="center">
                <Text size="sm" fw={700}>
                  {user.followersCount}
                </Text>
                <Text size="sm" c="dimmed">
                  followers
                </Text>
              </Flex>
            </Flex>
          </Stack>
        )}
      </HoverCard.Dropdown>
    </HoverCard>
  );
}
