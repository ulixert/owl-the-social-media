import { useNavigate } from 'react-router-dom';

import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';

export function useOpenLoginModal() {
  const navigate = useNavigate();

  return () =>
    modals.openConfirmModal({
      title: (
        <Text fz={20} fw={600}>
          Say more with Owls
        </Text>
      ),
      withOverlay: true,
      overlayProps: {
        backgroundOpacity: 0.5,
        blur: 3,
      },
      closeButtonProps: {
        display: 'none',
      },
      centered: true,
      radius: 'lg',
      padding: 'lg',
      transitionProps: { transition: 'fade', duration: 200 },
      withCloseButton: true,
      children: (
        <Text>
          Join Owls to connect with friends and share your stories with the
          world
        </Text>
      ),
      labels: { confirm: 'Log in', cancel: 'Sign up' },
      onConfirm: () => void navigate('/login'),
      onCancel: () => void navigate('/signup'),
    });
}
