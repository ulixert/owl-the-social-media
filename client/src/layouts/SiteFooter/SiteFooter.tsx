import { Anchor, Group, Text } from '@mantine/core';

import classes from './SiteFooter.module.css';

const LINKS = ['About', 'Privacy', 'Terms', 'Help'];

// A simple footer at the bottom of the column.
export function SiteFooter() {
  return (
    <footer className={classes.footer}>
      <Text size="xs" c="dimmed">
        © {new Date().getFullYear()} Owl
      </Text>
      <Group gap="sm">
        {LINKS.map((label) => (
          <Anchor key={label} href="#" size="xs" c="dimmed" underline="hover">
            {label}
          </Anchor>
        ))}
      </Group>
    </footer>
  );
}
