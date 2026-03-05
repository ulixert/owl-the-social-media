import { useLocation, useNavigate } from 'react-router-dom';
import { ReturnButton } from '@/components/ReturnButton/ReturnButton.tsx';
import { Flex, Tabs, Text } from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';
import { useTitleStore } from '@stores/titleStore.ts';

import classes from './Header.module.css';

export function HeaderDesktop() {
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
    <Flex justify="center" align="center" h="100%" px="md">
      {!isHomeFeed && (
        <Flex align="center" gap="sm" w="100%">
          <ReturnButton />
          <Text fw={700} size="lg">
            {title}
          </Text>
        </Flex>
      )}

      {isHomeFeed && isAuthenticated && (
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          className={classes.tabs}
          variant="default"
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

      {isHomeFeed && !isAuthenticated && (
        <Text fw={700} size="lg">
          Home
        </Text>
      )}
    </Flex>
  );
}
