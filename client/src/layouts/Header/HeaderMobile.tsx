import { useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo/Logo.tsx';
import { ReturnButton } from '@/components/ReturnButton/ReturnButton.tsx';
import { Flex, Tabs, Text, Box } from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';
import { useTitleStore } from '@stores/titleStore.ts';

import classes from './Header.module.css';

export function HeaderMobile() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const title = useTitleStore((state) => state.title);
  const location = useLocation();
  const navigate = useNavigate();

  const isHomeFeed = ['/', '/for-you', '/following'].includes(location.pathname);
  const activeTab = location.pathname === '/following' ? 'following' : 'for-you';

  const handleTabChange = (value: string | null) => {
    if (value) {
      navigate(value === 'for-you' ? '/for-you' : '/following');
    }
  };

  return (
    <Flex justify="center" align="center" h="100%" px="md" pos="relative">
      {!isHomeFeed && (
        <>
          <Box pos="absolute" left={16}>
            <ReturnButton />
          </Box>
          <Text fw={700} size="lg">
            {title}
          </Text>
        </>
      )}

      {isHomeFeed && !isAuthenticated && (
        <>
          <Box pos="absolute" left={16}>
            <Logo size={24} />
          </Box>
          <Text fw={700} size="lg">
            Home
          </Text>
        </>
      )}

      {isHomeFeed && isAuthenticated && (
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          className={classes.tabs}
          variant="default"
          w="100%"
        >
          <Tabs.List grow>
            <Tabs.Tab value="for-you" className={classes.tab}>
              For You
            </Tabs.Tab>
            <Tabs.Tab value="following" className={classes.tab}>
              Following
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      )}
    </Flex>
  );
}
