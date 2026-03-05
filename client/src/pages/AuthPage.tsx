import { Outlet } from 'react-router-dom';

import { Container } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';

export function AuthPage() {
  return (
    <ModalsProvider>
      <Container size={420} my={40}>
        <Outlet />
      </Container>
    </ModalsProvider>
  );
}
