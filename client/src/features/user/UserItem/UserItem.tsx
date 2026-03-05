import { useNavigate } from 'react-router-dom';
import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import { useFollowMutation } from '../hooks/useFollowMutation.ts';
import { useAuthStore } from '@stores/authStore.ts';
import { useOpenLoginModal } from '@/hooks/useOpenLoginModal.tsx';
import { Box, Button, Divider, Flex, Stack, Text } from '@mantine/core';
import { UserHoverCard } from '../UserHoverCard/UserHoverCard.tsx';

export type SearchUser = {
  id: number;
  username: string;
  name: string;
  profilePic: string | null;
  biography: string | null;
  followersCount: number;
  isFollowing: boolean;
};

type UserItemProps = {
  user: SearchUser;
};

export function UserItem({ user }: UserItemProps) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.userData);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openLoginModal = useOpenLoginModal();
  const followMutation = useFollowMutation(user.id, user.username);

  const isCurrentUser = currentUser?.userId === user.id;

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    followMutation.mutate();
  };

  return (
    <>
      <Flex
        gap="md"
        py="sm"
        style={{ cursor: 'pointer' }}
        onClick={() => navigate(`/user/${user.username}`)}
      >
        <UserHoverCard username={user.username}>
          <Box onClick={(e) => e.stopPropagation()}>
            <UserAvatar
              username={user.username}
              avatar={user.profilePic}
              size="md"
            />
          </Box>
        </UserHoverCard>

        <Stack gap={2} flex={1} style={{ minWidth: 0 }}>
          <Flex justify="space-between" align="start">
            <Box style={{ minWidth: 0 }}>
              <UserHoverCard username={user.username}>
                <Box onClick={(e) => e.stopPropagation()}>
                  <Text fw={700} size="sm" truncate>
                    {user.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    @{user.username}
                  </Text>
                </Box>
              </UserHoverCard>
            </Box>

            {!isCurrentUser && (
              <Button
                size="compact-xs"
                radius="md"
                variant={user.isFollowing ? 'outline' : 'filled'}
                color={user.isFollowing ? 'gray' : 'dark'}
                onClick={handleFollow}
                loading={followMutation.isPending}
                px="md"
              >
                {user.isFollowing ? 'Following' : 'Follow'}
              </Button>
            )}
          </Flex>

          <Text size="xs" c="gray.7" fw={500}>
            {user.followersCount} followers
          </Text>

          {user.biography && (
            <Text size="sm" lineClamp={2} mt={2}>
              {user.biography}
            </Text>
          )}
        </Stack>
      </Flex>
      <Divider ml={52} />
    </>
  );
}
