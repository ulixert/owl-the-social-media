import { useNavigate } from 'react-router-dom';

import { useOpenLoginModal } from '@/hooks/useOpenLoginModal.tsx';
import { UnstyledButton, rem } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useAuthStore } from '@stores/authStore.ts';
import { useTitleStore } from '@stores/titleStore.ts';
import { IconHome } from '@tabler/icons-react';

import { CreatePost } from '@/features/posts/CreatePost/CreatePost.tsx';
import classes from './NavLinks.module.css';

type NavLinkProps = {
  icon: typeof IconHome;
  active?: boolean;
  onClick: () => void;
  needLogin?: boolean;
  path: string;
  type?: 'link' | 'action';
};

export function NavLink({
  icon: Icon,
  active,
  onClick,
  needLogin,
  path,
  type = 'link',
}: NavLinkProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const navigate = useNavigate();
  const setTitle = useTitleStore((state) => state.setTitle);
  const openLoginModal = useOpenLoginModal();

  function handleClick() {
    onClick();

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
              onCancel={() => modals.close(modalId)}
              onSuccess={() => modals.close(modalId)}
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

  return (
    <UnstyledButton
      onClick={handleClick}
      className={classes.link}
      data-active={active ? 'true' : undefined}
    >
      <Icon style={{ width: rem(30), height: rem(30) }} stroke={1.5} />
    </UnstyledButton>
  );
}
