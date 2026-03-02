import {
  Anchor,
  Avatar,
  Box,
  Button,
  Flex,
  Stack,
  Tabs,
  Text,
} from '@mantine/core';
import { IconBrandInstagram } from '@tabler/icons-react';

import { UserMoreMenu } from '../UserMoreMenu/UserMoreMenu.tsx';
import classes from './UserHeader.module.css';

type UserHeaderProps = {
  tab: 'posts' | 'replies';
  onTabChange: (tab: string) => void;
};

export function UserHeader({ tab, onTabChange }: UserHeaderProps) {
  return (
    <Stack gap={16} align="start" className={classes.container}>
      <Flex justify="space-between" w="100%">
        <Box>
          <Text size="xl">Thomas</Text>
          <Flex gap={8} align={'center'}>
            <Text size="sm" c="gray.6">
              @Thomas
            </Text>
            <Button size="xs" className={classes.net} radius="lg" component="a">
              Owl.net
            </Button>
          </Flex>
        </Box>
        <Box>
          <Avatar alt="Thomas" src="/avatar.webp" hiddenFrom="sm" size="lg" />
          <Avatar alt="Thomas" src="/avatar.webp" visibleFrom="sm" size="xl" />
        </Box>
      </Flex>

      <Text>Father, citizen and a dog keeper</Text>

      <Flex w="100%" justify="space-between">
        <Flex gap={8} align={'center'} c="gray.6" className={classes.follow}>
          <Anchor c="inherit">
            <span>3.2k</span> follows
          </Anchor>
          <Text>&bull;</Text>
          <Anchor c="inherit">
            <span>1.2k</span> followers
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
