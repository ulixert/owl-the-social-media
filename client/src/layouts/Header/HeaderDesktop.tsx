import { useLocation } from 'react-router-dom';
import { ReturnButton } from '@/components/ReturnButton/ReturnButton.tsx';
import { LoginButton } from '@/components/LoginButton/LoginButton.tsx';
import { Box, Flex, Text } from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';
import { useTitleStore } from '@stores/titleStore.ts';

import classes from './Header.module.css';

export function HeaderDesktop() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const title = useTitleStore((state) => state.title);
  const location = useLocation();

  const isHomeFeed = ['/', '/for-you', '/following'].includes(location.pathname);

  return (
    // Centered so the header bar sits over the centered feed column. Just the feed
    // title — switching between feeds happens in the sidebar "Feeds" list, so there
    // are no top tabs.
    <Flex justify="center" align="center" h="100%" className={classes.container}>
      <Box className={classes.bar}>
        {!isHomeFeed && (
          <Box className={classes.backButton}>
            <ReturnButton />
          </Box>
        )}

        <Text className={classes.title}>{title}</Text>

        {isHomeFeed && !isAuthenticated && (
          <Box className={classes.rightButton}>
            <LoginButton />
          </Box>
        )}
      </Box>
    </Flex>
  );
}
