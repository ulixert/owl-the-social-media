import { useNavigate } from 'react-router-dom';

import { useLogoutMutation } from '@/features/auth/hooks/useLogoutMutation.ts';
import {
  Menu,
  UnstyledButton,
  rem,
  useMantineColorScheme,
} from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';
import { useTitleStore } from '@stores/titleStore.ts';
import {
  IconBookmark,
  IconLogout,
  IconMoon,
  IconSun,
  IconUser,
} from '@tabler/icons-react';

import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import classes from './NavLinks.module.css';

export function ProfileNavLink({ active }: { active?: boolean }) {
  const { userData } = useAuthStore();
  const navigate = useNavigate();
  const setTitle = useTitleStore((state) => state.setTitle);
  const logoutMutation = useLogoutMutation();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  if (!userData) return null;

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const navigateTo = (path: string, title: string) => {
    setTitle(title);
    void navigate(path);
  };

  const isDark = colorScheme === 'dark';

  return (
    <Menu shadow="md" width={200} position="top-end" offset={10} withArrow>
      <Menu.Target>
        <UnstyledButton
          className={classes.link}
          data-active={active ? 'true' : undefined}
        >
          <IconUser style={{ width: rem(30), height: rem(30) }} stroke={1.5} />
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Account</Menu.Label>
        <Menu.Item
          leftSection={<IconUser size={16} stroke={1.5} />}
          onClick={() => navigateTo('/profile', 'Profile')}
        >
          Profile
        </Menu.Item>
        <Menu.Item
          leftSection={<IconBookmark size={16} stroke={1.5} />}
          onClick={() => navigateTo('/saved', 'Saved')}
        >
          Saved
        </Menu.Item>

        <Menu.Divider />

        <Menu.Label>Settings</Menu.Label>
        <Menu.Item
          leftSection={
            isDark ? (
              <IconSun size={16} stroke={1.5} />
            ) : (
              <IconMoon size={16} stroke={1.5} />
            )
          }
          onClick={() => toggleColorScheme()}
        >
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item
          color="red"
          leftSection={<IconLogout size={16} stroke={1.5} />}
          onClick={handleLogout}
        >
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
