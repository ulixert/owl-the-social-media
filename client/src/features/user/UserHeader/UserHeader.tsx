import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import { UserProfile } from '@/hooks/useUserProfile.ts';
import { Anchor, Box, Button, Flex, Stack, Tabs, Text } from '@mantine/core';
import { IconBrandInstagram } from '@tabler/icons-react';

import { UserMoreMenu } from '../UserMoreMenu/UserMoreMenu.tsx';
import classes from './UserHeader.module.css';

type UserHeaderProps = {
  tab: 'posts' | 'replies';
  onTabChange: (tab: string) => void;
  user: UserProfile;
};

export function UserHeader({ tab, onTabChange, user }: UserHeaderProps) {
  return (
    <Stack gap={16} align="start" className={classes.container}>
      <Flex justify="space-between" w="100%">
        <Box>
          <Text size="xl">{user.username}</Text>
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
            hiddenFrom="sm"
            size="lg"
          />
          <UserAvatar
            username={user.username}
            avatar={user.profilePic}
            visibleFrom="sm"
            size="xl"
          />
        </Box>
      </Flex>

      <Text>{user.biography ?? 'introduce yourself'}</Text>

      <Flex w="100%" justify="space-between">
        <Flex gap={8} align={'center'} c="gray.6" className={classes.follow}>
          <Anchor c="inherit">
            <span>{user.followingCount}</span> follows
          </Anchor>
          <Text>&bull;</Text>
          <Anchor c="inherit">
            <span>{user.followersCount}</span> followers
          </Anchor>
        </Flex>
        <Flex>
          <Box className={classes.iconContainer}>
            <IconBrandInstagram size={24} cursor="pointer" />
          </Box>
          <UserMoreMenu />
        </Flex>
      </Flex>

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
