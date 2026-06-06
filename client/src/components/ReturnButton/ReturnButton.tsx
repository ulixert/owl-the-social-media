import { useLocation, useNavigate } from 'react-router-dom';

import { ActionIcon } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';

import styles from './ReturnButton.module.css';

export function ReturnButton() {
  const navigate = useNavigate();
  const location = useLocation();
  // Derived directly from the route — no effect/state needed.
  const showButton = location.pathname !== '/';

  function handleBack() {
    if (location.key === 'initial') {
      void navigate('/');
    } else {
      void navigate(-1);
    }
  }

  return (
    showButton && (
      <ActionIcon
        className={styles.return}
        onClick={handleBack}
        variant="subtle"
        radius="xl"
        color="gray"
        size={34}
        aria-label="Go back"
      >
        <IconArrowLeft size={20} />
      </ActionIcon>
    )
  );
}
