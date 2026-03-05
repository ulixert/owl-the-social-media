import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import { UserProfile } from '@/hooks/useUserProfile.ts';
import { Anchor, Box, Button, Flex, Stack, Tabs, Text } from '@mantine/core';
import { IconBrandInstagram } from '@tabler/icons-react';
import { useAuthStore } from '@stores/authStore.ts';
import { useFollowMutation } from '../hooks/useFollowMutation.ts';
import { useOpenLoginModal } from '@/hooks/useOpenLoginModal.tsx';

import { UserMoreMenu } from '../UserMoreMenu/UserMoreMenu.tsx';
import classes from './UserHeader.module.css';

type UserHeaderProps = {
  tab: 'posts' | 'replies';
  onTabChange: (tab: string) => void;
  user: UserProfile;
};

export function UserHeader({ tab, onTabChange, user }: UserHeaderProps) {
  const currentUser = useAuthStore((state) => state.userData);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openLoginModal = useOpenLoginModal();
  const isCurrentUser = currentUser?.userId === user.id;
  const followMutation = useFollowMutation(user.id, user.username);

  const handleFollow = () => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    followMutation.mutate();
  };

  return (
    <Stack gap={16} align="start" className={classes.container}>
      <Flex justify="space-between" w="100%">
        <Box>
          <Text size="xl" fw={700}>
            {user.name || user.username}
          </Text>
          <Flex gap={8} align={'center'}>
            <Text size="sm" c="gray.6">
              @{user.username}
            </Text>
            <Button size="xs" className={classes.net} radius="lg" component="a">
              Owl.net
            </Button>
          </Flex>
        </Box>
        <Box>
          <UserAvatar
            username={user.username}
            avatar={user.profilePic}
            size="xl"
          />
        </Box>
      </Flex>

      <Text size="sm">{user.biography ?? 'No bio yet.'}</Text>

      <Flex w="100%" justify="space-between" align="center">
        <Flex gap={8} align={'center'} c="gray.6" className={classes.follow}>
          <Anchor c="inherit" size="sm">
            <span>{user.followersCount}</span> followers
          </Anchor>
          <Text>&bull;</Text>
          <Anchor c="inherit" size="sm">
            <span>{user.followingCount}</span> following
          </Anchor>
          <Text>&bull;</Text>
          <Anchor c="inherit" size="sm">
            <span>{user.likesCount}</span> likes
          </Anchor>
        </Flex>
        <Flex gap={12}>
          <Box className={classes.iconContainer}>
            <IconBrandInstagram size={24} cursor="pointer" />
          </Box>
          <UserMoreMenu />
        </Flex>
      </Flex>

      {!isCurrentUser ? (
        <Button
          fullWidth
          variant={user.isFollowing ? 'outline' : 'filled'}
          color={user.isFollowing ? 'gray' : 'dark'}
          radius="md"
          onClick={handleFollow}
          loading={followMutation.isPending}
        >
          {user.isFollowing ? 'Following' : 'Follow'}
        </Button>
      ) : (
        <Button fullWidth variant="outline" color="gray" radius="md">
          Edit profile
        </Button>
      )}

      <Tabs
        defaultValue="posts"
        w="100%"
        value={tab}
        onChange={(v) => onTabChange(v!)}
      >
        <Tabs.List>
          <Tabs.Tab value="posts" fw={600} className={classes.tab} py={12}>
            Posts
          </Tabs.Tab>
          <Tabs.Tab value="replies" className={classes.tab} fw={500} c="gray.6">
            Replies
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
    </Stack>
  );
}
