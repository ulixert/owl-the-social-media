import { useLocation } from 'react-router-dom';
import { NavLink } from './NavLink.tsx';
import { ProfileNavLink } from './ProfileNavLink.tsx';
import { icons } from './icons.ts';

type NavLinksProps = {
  isMobile?: boolean;
};

export function NavLinks({ isMobile }: NavLinksProps) {
  const location = useLocation();

  return icons.map((link) => {
    // Exact match for home, partial for others (except home itself)
    const active =
      link.path === '/'
        ? location.pathname === '/' ||
          location.pathname === '/for-you' ||
          location.pathname === '/following'
        : location.pathname.startsWith(link.path);

    if (isMobile && link.path === '/profile') {
      return <ProfileNavLink key={link.path} active={active} />;
    }

    return (
      <NavLink
        {...link}
        key={link.path}
        active={active}
      />
    );
  });
}
