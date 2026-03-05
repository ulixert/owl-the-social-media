import { Suspense } from 'react';
import { Outlet, useNavigation } from 'react-router-dom';

import { Loading } from '@/components/Loading/Loading.tsx';
import { AppShell, Container } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';

import { Footer } from '../Footer/Footer.tsx';
import { Header } from '../Header/Header.tsx';
import { NavBar } from '../NavBar/NavBar.tsx';
import classes from './AppLayout.module.css';

export function AppLayout() {
  const navigation = useNavigation();

  return (
    <ModalsProvider>
      {navigation.state === 'loading' && <Loading />}

      <AppShell
        layout="alt"
        padding={0}
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

        <Container size={640} className={classes.container}>
          <AppShell.Main className={classes.main}>
            <Suspense fallback={<Loading />}>
              <Outlet />
            </Suspense>
          </AppShell.Main>
        </Container>

        <AppShell.Footer hiddenFrom="sm" withBorder={false} className={classes.footer}>
          <Footer />
        </AppShell.Footer>
      </AppShell>
    </ModalsProvider>
  );
}
