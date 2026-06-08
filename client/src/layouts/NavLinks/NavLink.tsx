import { useNavigate } from 'react-router-dom';

import { useOpenLoginModal } from '@/hooks/useOpenLoginModal.tsx';
import { Indicator, Text, UnstyledButton, rem } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useAuthStore } from '@stores/authStore.ts';
import { useTitleStore } from '@stores/titleStore.ts';
import { IconHome } from '@tabler/icons-react';

import { CreatePost } from '@/features/posts/CreatePost/CreatePost.tsx';
import classes from './NavLinks.module.css';

type NavLinkProps = {
  icon: typeof IconHome;
  active?: boolean;
  onClick?: () => void;
  needLogin?: boolean;
  path: string;
  type?: 'link' | 'action';
  // When provided with `expanded`, the item renders as a labelled row (the
  // desktop sidebar). Without it, it stays an icon-only button (mobile footer).
  label?: string;
  expanded?: boolean;
  // Unread count shown as a pill on the labelled row (e.g. Activity).
  badge?: number;
};

export function NavLink({
  icon: Icon,
  active,
  onClick,
  needLogin,
  path,
  type = 'link',
  label,
  expanded,
  badge,
}: NavLinkProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const navigate = useNavigate();
  const setTitle = useTitleStore((state) => state.setTitle);
  const openLoginModal = useOpenLoginModal();

  // The icon, with the unread count overlaid as a corner indicator so it's
  // visible even in icon-only modes (mobile footer, collapsed rail).
  const renderIcon = (size: number) => {
    const icon = <Icon style={{ width: rem(size), height: rem(size) }} stroke={1.5} />;
    if (!badge) return icon;
    return (
      <Indicator
        inline
        size={16}
        offset={2}
        color="mono"
        label={badge > 99 ? '99+' : badge}
        aria-label={`${badge} unread`}
      >
        {icon}
      </Indicator>
    );
  };

  function handleClick() {
    onClick?.();

    if (needLogin && !isAuthenticated) {
      openLoginModal();
      return;
    }

    if (type === 'action') {
      if (path === '/create') {
        const modalId = 'create-post-modal';
        modals.open({
          id: modalId,
          children: (
            <CreatePost
              isModal
              // closeAll, not close(modalId) — close-by-id wasn't matching, so
              // Cancel did nothing (there's only one compose modal anyway).
              onCancel={() => modals.closeAll()}
              onSuccess={() => modals.closeAll()}
            />
          ),
          size: 'lg',
          radius: 'lg',
          withCloseButton: false,
          centered: true,
          padding: 'md',
        });
      }
    } else {
      void navigate(path);
      if (path !== '/') {
        setTitle(path[1].toUpperCase() + path.slice(2));
      }
    }
  }

  if (expanded && label) {
    return (
      <UnstyledButton
        onClick={handleClick}
        className={classes.linkExpanded}
        data-active={active ? 'true' : undefined}
      >
        {renderIcon(24)}
        <Text className={classes.linkLabel}>{label}</Text>
      </UnstyledButton>
    );
  }

  return (
    <UnstyledButton
      onClick={handleClick}
      className={classes.link}
      data-active={active ? 'true' : undefined}
    >
      {renderIcon(26)}
    </UnstyledButton>
  );
}
