import { useLocation, useNavigate } from 'react-router-dom';

import { Logo } from '@/components/Logo/Logo.tsx';
import { useLogoutMutation } from '@/features/auth/hooks/useLogoutMutation.ts';
import {
  Box,
  Menu,
  Stack,
  Text,
  UnstyledButton,
  rem,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';
import {
  IconBell,
  IconBookmark,
  IconHeart,
  IconHome,
  IconLogout,
  IconMail,
  IconMenu2,
  IconMoon,
  IconPlus,
  IconSearch,
  IconSun,
  IconUser,
} from '@tabler/icons-react';

import { NavLink } from '../NavLinks/NavLink.tsx';
import navClasses from '../NavLinks/NavLinks.module.css';

// Main navigation, top to bottom. `New thread` opens the compose modal (handled
// in NavLink); Messages/Activity are scaffolded placeholders for the upcoming
// real-time work.
// Two groups (Threads order) with a gap between: the primary actions on top, the
// personal/account items below.
const TOP_ITEMS = [
  { icon: IconHome, label: 'Home', path: '/', type: 'link' as const },
  {
    icon: IconPlus,
    label: 'New post',
    path: '/create',
    type: 'action' as const,
    needLogin: true,
  },
  { icon: IconSearch, label: 'Search', path: '/search', type: 'link' as const },
];

const BOTTOM_ITEMS = [
  { icon: IconMail, label: 'Messages', path: '/messages', type: 'link' as const, needLogin: true },
  { icon: IconBell, label: 'Activity', path: '/activity', type: 'link' as const, needLogin: true },
  { icon: IconUser, label: 'Profile', path: '/profile', type: 'link' as const, needLogin: true },
  { icon: IconHeart, label: 'Liked', path: '/liked', type: 'link' as const, needLogin: true },
];

// "Home" above is the For You feed, so Feeds lists only the alternative feeds.
const FEED_ITEMS = [
  { label: 'Following', path: '/following' },
  { label: 'Hot', path: '/hot' },
];

export function NavBar() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const mutation = useLogoutMutation();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  function handleColorSchemeChange() {
    setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light');
  }

  const isMainActive = (path: string) =>
    path === '/'
      ? location.pathname === '/' || location.pathname === '/for-you'
      : location.pathname.startsWith(path);

  return (
    <Stack h="100%" gap={4} px={4}>
      <Box px={14} py="md">
        <Logo size={34} justify="flex-start" />
      </Box>

      <Stack gap={2}>
        {TOP_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            icon={item.icon}
            label={item.label}
            path={item.path}
            type={item.type}
            needLogin={item.needLogin}
            active={isMainActive(item.path)}
            expanded
          />
        ))}
      </Stack>

      <Stack gap={2} mt="md">
        {BOTTOM_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            icon={item.icon}
            label={item.label}
            path={item.path}
            type={item.type}
            needLogin={item.needLogin}
            active={isMainActive(item.path)}
            expanded
          />
        ))}
      </Stack>

      <Text className={navClasses.sectionLabel} mt="md">
        Feeds
      </Text>
      <Stack gap={2}>
        {FEED_ITEMS.map((feed) => (
          <UnstyledButton
            key={feed.path}
            className={navClasses.feedLink}
            data-active={location.pathname === feed.path ? 'true' : undefined}
            onClick={() => void navigate(feed.path)}
          >
            {feed.label}
          </UnstyledButton>
        ))}
      </Stack>

      <Box style={{ flex: 1 }} />

      <Menu position="right-end" shadow="md" width={220}>
        <Menu.Target>
          <UnstyledButton className={navClasses.linkExpanded}>
            <IconMenu2 style={{ width: rem(26), height: rem(26) }} stroke={1.5} />
            <Text className={navClasses.linkLabel}>More</Text>
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown>
          {isAuthenticated && (
            <>
              <Menu.Label>Collections</Menu.Label>
              <Menu.Item
                leftSection={<IconBookmark style={{ width: rem(16), height: rem(16) }} />}
                onClick={() => navigate('/saved')}
              >
                Saved
              </Menu.Item>
              <Menu.Divider />
            </>
          )}

          <Menu.Label>Appearance</Menu.Label>
          <Menu.Item
            leftSection={
              computedColorScheme === 'light' ? (
                <IconMoon style={{ width: rem(16), height: rem(16) }} />
              ) : (
                <IconSun style={{ width: rem(16), height: rem(16) }} />
              )
            }
            onClick={handleColorSchemeChange}
          >
            Switch to {computedColorScheme === 'light' ? 'Dark' : 'Light'} mode
          </Menu.Item>

          {isAuthenticated && (
            <>
              <Menu.Divider />
              <Menu.Label>Account</Menu.Label>
              <Menu.Item
                color="red"
                leftSection={<IconLogout style={{ width: rem(16), height: rem(16) }} />}
                onClick={() => mutation.mutate()}
              >
                Logout
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>
    </Stack>
  );
}
