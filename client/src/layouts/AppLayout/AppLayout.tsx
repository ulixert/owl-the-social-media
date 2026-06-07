import { Suspense } from 'react';
import { Outlet, useNavigation } from 'react-router-dom';

import { Loading } from '@/components/Loading/Loading.tsx';
import { useNotificationSocket } from '@/hooks/useNotificationSocket.ts';
import { AppShell } from '@mantine/core';
import { useHover, useMediaQuery } from '@mantine/hooks';
import { ModalsProvider } from '@mantine/modals';

import { Footer } from '../Footer/Footer.tsx';
import { Header } from '../Header/Header.tsx';
import { NavBar } from '../NavBar/NavBar.tsx';
import { SiteFooter } from '../SiteFooter/SiteFooter.tsx';
import classes from './AppLayout.module.css';

export function AppLayout() {
  const navigation = useNavigation();

  // Keep one live notification socket open for the whole authenticated session.
  useNotificationSocket();

  // Sidebar expand state — ONE source of truth on the navbar element, so the
  // width overlay and the labels/feeds (in NavBar) can never disagree. Below lg
  // it's a hover-to-expand icon rail; at lg+ it's always the full sidebar.
  const isLarge = useMediaQuery('(min-width: 75em)', true, {
    getInitialValueInEffect: false,
  });
  const { hovered, ref } = useHover<HTMLElement>();
  const expanded = isLarge || hovered;
  const overlayExpanded = !isLarge && hovered;

  return (
    <ModalsProvider>
      {navigation.state === 'loading' && <Loading />}

      <AppShell
        layout="alt"
        padding={0}
        // Icon rail (80px) below lg, full labelled sidebar (245px) at lg+;
        // hidden on mobile. The rail expands to 245px on hover (CSS overlay).
        navbar={{
          width: { base: 80, lg: 245 },
          breakpoint: 'sm',
          collapsed: { mobile: true },
        }}
        transitionDuration={500}
        transitionTimingFunction="ease"
      >
        <AppShell.Navbar
          ref={ref}
          p="md"
          pt={0}
          withBorder={false}
          className={classes.navbar}
          // Overlay-expand to the full sidebar on hover (below lg). The reserved
          // width (main offset) stays at the rail width, so this floats over the
          // feed instead of shifting it.
          style={
            overlayExpanded
              ? {
                  width: 245,
                  boxShadow: 'var(--mantine-shadow-md)',
                  zIndex: 201,
                }
              : undefined
          }
        >
          <NavBar expanded={expanded} />
        </AppShell.Navbar>

        <AppShell.Header withBorder={false} className={classes.header}>
          <Header />
        </AppShell.Header>

        <AppShell.Main className={classes.main}>
          <div className={classes.columnWrap}>
            <div className={classes.column}>
              {/* Sticky cap keeps the rounded top corner tucked under the header
                  as the page scrolls. */}
              <div className={classes.cap} />
              <Suspense fallback={<Loading />}>
                <Outlet />
              </Suspense>
            </div>
            <SiteFooter />
          </div>
        </AppShell.Main>

        <AppShell.Footer hiddenFrom="sm" withBorder={false} className={classes.footer}>
          <Footer />
        </AppShell.Footer>
      </AppShell>
    </ModalsProvider>
  );
}
