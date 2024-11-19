import { useState } from 'react';

import { NavLink } from './NavLink.tsx';
import { icons } from './icons.ts';

export function NavLinks() {
  const [active, setActive] = useState(2);

  return icons.map((link, index) => (
    <NavLink
      {...link}
      key={link.label}
      active={index === active}
      onClick={() => setActive(index)}
    />
  ));
}