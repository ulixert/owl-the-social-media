import { Suspense } from 'react';
import { Outlet, useNavigation } from 'react-router-dom';

import { Loading } from '@/components/Loading/Loading.tsx';
import { useNotificationSocket } from '@/hooks/useNotificationSocket.ts';
import { AppShell } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';

import { Footer } from '../Footer/Footer.tsx';
import { Header } from '../Header/Header.tsx';
import { NavBar } from '../NavBar/NavBar.tsx';
import classes from './AppLayout.module.css';

export function AppLayout() {
  const navigation = useNavigation();

  // Keep one live notification socket open for the whole authenticated session.
  useNotificationSocket();

  return (
    <ModalsProvider>
      {navigation.state === 'loading' && <Loading />}

      <AppShell
        layout="alt"
        padding={0}
        navbar={{ width: 245, breakpoint: 'sm' }}
        transitionDuration={500}
        transitionTimingFunction="ease"
      >
        <AppShell.Navbar
          p="md"
          visibleFrom="sm"
          withBorder={false}
          className={classes.navbar}
        >
          <NavBar />
        </AppShell.Navbar>

        <AppShell.Header withBorder={false} className={classes.header}>
          <Header />
        </AppShell.Header>

        <AppShell.Main className={classes.main}>
          <div className={classes.column}>
            <Suspense fallback={<Loading />}>
              <Outlet />
            </Suspense>
          </div>
        </AppShell.Main>

        <AppShell.Footer hiddenFrom="sm" withBorder={false} className={classes.footer}>
          <Footer />
        </AppShell.Footer>
      </AppShell>
    </ModalsProvider>
  );
}
