import { Flex } from '@mantine/core';

import { Logo } from '../Logo/Logo.tsx';
import styles from './Header.module.css';

export function Header({ children }: React.PropsWithChildren) {
  return (
    <Flex
      align="center"
      mt={24}
      mb={32}
      justify="center"
      className={styles.header}
    >
      {children}
      <Logo />
    </Flex>
  );
}
