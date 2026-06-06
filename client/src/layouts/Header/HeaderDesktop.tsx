import { useLocation } from 'react-router-dom';
import { ReturnButton } from '@/components/ReturnButton/ReturnButton.tsx';
import { LoginButton } from '@/components/LoginButton/LoginButton.tsx';
import { Flex, Text } from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';
import { useTitleStore } from '@stores/titleStore.ts';

import classes from './Header.module.css';

export function HeaderDesktop() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const title = useTitleStore((state) => state.title);
  const location = useLocation();

  // Top-level feed routes show a left-aligned title with no back button; detail
  // pages (a post, a profile) get the back button instead.
  const isHomeFeed = ['/', '/for-you', '/following', '/trending'].includes(
    location.pathname,
  );

  return (
    // Threads-style: a left-aligned feed/page title (with a back button before it
    // on detail pages) and any actions pushed to the right — centered over the
    // feed column via the same compensation the column uses.
    <Flex justify="center" align="center" h="100%" className={classes.container}>
      <Flex className={classes.bar} align="center" gap="xs">
        {!isHomeFeed && <ReturnButton />}
        <Text className={classes.barTitle}>{title}</Text>
        {isHomeFeed && !isAuthenticated && <LoginButton />}
      </Flex>
    </Flex>
  );
}
