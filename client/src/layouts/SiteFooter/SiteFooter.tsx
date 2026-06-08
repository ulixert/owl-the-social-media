import { Text } from '@mantine/core';

import classes from './SiteFooter.module.css';

// A minimal footer, sitting well below the card.
export function SiteFooter() {
  return (
    <footer className={classes.footer}>
      <Text size="xs" c="dimmed">
        © {new Date().getFullYear()} Owl
      </Text>
    </footer>
  );
}
