import { Logo } from '@/components/Logo/Logo.tsx';
import { useLogoutMutation } from '@/features/auth/hooks/useLogoutMutation.ts';
import {
  Center,
  Stack,
  useComputedColorScheme,
  useMantineColorScheme,
  Menu,
  UnstyledButton,
  rem,
} from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';
import {
  IconLogout,
  IconSun,
  IconMoon,
  IconMenu2,
  IconBookmark,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { NavLinks } from '../NavLinks/NavLinks.tsx';
import classes from './NavBar.module.css';

export function NavBar() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const mutation = useLogoutMutation();
  const navigate = useNavigate();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  function handleColorSchemeChange() {
    setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light');
  }

  return (
    <>
      <Center mb={40}>
        <Logo />
      </Center>

      <Stack justify="center" align="center" gap={10} flex={1}>
        <NavLinks />
      </Stack>

      <Stack justify="center" align="center" gap={0} mt={40}>
        <Menu position="right-end" shadow="md" width={200}>
          <Menu.Target>
            <UnstyledButton className={classes.link}>
              <IconMenu2 style={{ width: rem(30), height: rem(30) }} stroke={1.5} />
            </UnstyledButton>
          </Menu.Target>

          <Menu.Dropdown>
            {isAuthenticated && (
              <>
                <Menu.Item
                  leftSection={
                    <IconBookmark style={{ width: rem(16), height: rem(16) }} />
                  }
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
                  leftSection={
                    <IconLogout style={{ width: rem(16), height: rem(16) }} />
                  }
                  onClick={() => mutation.mutate()}
                >
                  Logout
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Stack>
    </>
  );
}
