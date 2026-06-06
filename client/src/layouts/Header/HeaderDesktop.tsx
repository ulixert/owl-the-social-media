import { useLocation } from 'react-router-dom';
import { ReturnButton } from '@/components/ReturnButton/ReturnButton.tsx';
import { LoginButton } from '@/components/LoginButton/LoginButton.tsx';
import { useReloadFeed } from '@/hooks/useReloadFeed.ts';
import { Box, Flex, UnstyledButton } from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';
import { useTitleStore } from '@stores/titleStore.ts';

import classes from './Header.module.css';

export function HeaderDesktop() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const title = useTitleStore((state) => state.title);
  const location = useLocation();
  const reloadFeed = useReloadFeed();

  // Top-level feed routes show no back button; detail pages (a post, a profile)
  // get the back button on the far left instead.
  const isHomeFeed = ['/', '/for-you', '/following', '/trending'].includes(
    location.pathname,
  );

  return (
    // Threads-style: the title is centered over the feed column; the back button
    // (detail pages) and any actions sit on the edges. Clicking the title reloads
    // the feed (scroll to top + refetch).
    <Flex justify="center" align="center" h="100%" className={classes.container}>
      <Box className={classes.bar}>
        {!isHomeFeed && (
          <Box className={classes.barLeft}>
            <ReturnButton />
          </Box>
        )}
        <UnstyledButton className={classes.barTitle} onClick={reloadFeed}>
          {title}
        </UnstyledButton>
        {isHomeFeed && !isAuthenticated && (
          <Box className={classes.barRight}>
            <LoginButton />
          </Box>
        )}
      </Box>
    </Flex>
  );
}
