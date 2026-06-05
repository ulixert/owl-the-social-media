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
        gap="sm"
        py="sm"
        align="center"
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

        <Stack gap={0} flex={1} style={{ minWidth: 0 }}>
          <UserHoverCard username={user.username}>
            <Box
              onClick={(e) => e.stopPropagation()}
              style={{ minWidth: 0, width: 'fit-content' }}
            >
              <Text fw={700} size="sm" truncate>
                {user.name}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                @{user.username}
              </Text>
            </Box>
          </UserHoverCard>

          {user.biography && (
            <Text size="sm" c="dimmed" lineClamp={1}>
              {user.biography}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            {user.followersCount.toLocaleString()} followers
          </Text>
        </Stack>

        {!isCurrentUser && (
          <Button
            size="compact-sm"
            radius="md"
            variant={user.isFollowing ? 'default' : 'filled'}
            color={user.isFollowing ? undefined : 'dark'}
            onClick={handleFollow}
            loading={followMutation.isPending}
            px="lg"
          >
            {user.isFollowing ? 'Following' : 'Follow'}
          </Button>
        )}
      </Flex>
      <Divider ml={52} />
    </>
  );
}
