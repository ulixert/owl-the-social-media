import { Outlet } from 'react-router-dom';

import { Logo } from '@/components/Logo/Logo.tsx';
import { Box, Container } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';

export function AuthPage() {
  return (
    <ModalsProvider>
      <Container size={420} my={40}>
        {/* Clickable owl → home, so login/signup isn't a dead end. */}
        <Box mb="xl">
          <Logo size={44} justify="center" />
        </Box>
        <Outlet />
      </Container>
    </ModalsProvider>
  );
}
