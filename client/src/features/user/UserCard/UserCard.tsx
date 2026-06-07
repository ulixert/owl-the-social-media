import { useNavigate } from 'react-router-dom';

import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import { useOpenLoginModal } from '@/hooks/useOpenLoginModal.tsx';
import { useUserProfile } from '@/hooks/useUserProfile.ts';
import { Box, Button, Flex, Loader, Stack, Text } from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';

import { useFollowMutation } from '../hooks/useFollowMutation.ts';

type UserCardProps = {
  username: string;
  // Called right before navigating to the full profile — lets a host modal
  // close itself first.
  onNavigate?: () => void;
};

// Threads-style profile card: name + handle on the left, avatar on the right,
// bio, follower count, and a full-width follow button. Shared by the username
// hover card and the avatar modal.
export function UserCard({ username, onNavigate }: UserCardProps) {
  const navigate = useNavigate();
  const { data: user, isLoading } = useUserProfile(username);
  const currentUser = useAuthStore((state) => state.userData);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openLoginModal = useOpenLoginModal();
  const followMutation = useFollowMutation(user?.id ?? 0, username);

  const isCurrentUser = currentUser?.userId === user?.id;

  const goToProfile = () => {
    if (!user) return;
    onNavigate?.();
    void navigate(`/user/${user.username}`);
  };

  const handleFollow = () => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    followMutation.mutate();
  };

  if (isLoading || !user) {
    return (
      <Flex justify="center" py="md">
        <Loader size="sm" color="gray" />
      </Flex>
    );
  }

  return (
    <Stack gap="md">
      <Flex justify="space-between" align="flex-start" gap="md">
        <Box
          onClick={goToProfile}
          style={{ cursor: 'pointer', minWidth: 0 }}
        >
          <Text fw={700} size="lg" lh={1.2} truncate>
            {user.name || user.username}
          </Text>
          <Text size="sm" c="dimmed">
            @{user.username}
          </Text>
        </Box>
        <Box
          onClick={goToProfile}
          style={{ cursor: 'pointer', flexShrink: 0 }}
        >
          <UserAvatar
            username={user.username}
            avatar={user.profilePic}
            size="lg"
          />
        </Box>
      </Flex>

      {user.biography && (
        <Text size="sm" lineClamp={3}>
          {user.biography}
        </Text>
      )}

      <Flex gap={4} align="center">
        <Text size="sm" fw={700}>
          {user.followersCount}
        </Text>
        <Text size="sm" c="dimmed">
          followers
        </Text>
      </Flex>

      {!isCurrentUser && (
        <Button
          fullWidth
          radius="md"
          variant={user.isFollowing ? 'outline' : 'filled'}
          color={user.isFollowing ? 'gray' : 'mono'}
          onClick={handleFollow}
          loading={followMutation.isPending}
          fw={600}
        >
          {user.isFollowing ? 'Following' : 'Follow'}
        </Button>
      )}
    </Stack>
  );
}
