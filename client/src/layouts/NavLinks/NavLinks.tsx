import { useLocation } from 'react-router-dom';
import { NavLink } from './NavLink.tsx';
import { icons } from './icons.ts';

export function NavLinks() {
  const location = useLocation();

  return icons.map((link) => {
    // Exact match for home, partial for others (except home itself)
    const active =
      link.path === '/'
        ? location.pathname === '/' ||
          location.pathname === '/for-you' ||
          location.pathname === '/following'
        : location.pathname.startsWith(link.path);

    return (
      <NavLink
        {...link}
        key={link.path}
        active={active}
        onClick={() => {}}
      />
    );
  });
}
