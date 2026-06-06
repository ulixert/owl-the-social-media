import { Container } from '@mantine/core';

import classes from './Header.module.css';
import { HeaderDesktop } from './HeaderDesktop.tsx';
import { HeaderMobile } from './HeaderMobile.tsx';

export function Header() {
  return (
    <>
      <Container size={640} className={classes.container} hiddenFrom="sm">
        <HeaderMobile />
      </Container>
      {/* Full-width on desktop so HeaderDesktop's inner bar can center across the
          whole header region (and line up with the viewport-centered feed column),
          rather than being trapped in a 640px box that centers itself. */}
      <Container fluid p={0} className={classes.container} visibleFrom="sm">
        <HeaderDesktop />
      </Container>
    </>
  );
}
