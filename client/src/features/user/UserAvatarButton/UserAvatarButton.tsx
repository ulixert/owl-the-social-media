import { UnstyledButton } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useAuthStore } from '@stores/authStore.ts';
import { IconPlus } from '@tabler/icons-react';

import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import { UserCard } from '../UserCard/UserCard.tsx';
import classes from './UserAvatarButton.module.css';

type UserAvatarButtonProps = {
  username: string;
  avatar: string | null;
  size?: string;
  // Hide the "+" badge where a separate follow button already exists (e.g. user
  // list rows).
  withBadge?: boolean;
};

// Avatar that opens the Threads-style profile card in a modal on click (replaces
// the old hover-to-show-card behaviour). A "+" badge marks other users; clicking
// either the avatar or the badge opens the same modal, where you follow.
export function UserAvatarButton({
  username,
  avatar,
  size,
  withBadge = true,
}: UserAvatarButtonProps) {
  const currentUser = useAuthStore((state) => state.userData);
  const isSelf = currentUser?.username === username;

  const openCard = (e: React.MouseEvent) => {
    // Sit inside a post (which navigates on click) — don't bubble to it.
    e.preventDefault();
    e.stopPropagation();
    const id = 'user-card-modal';
    modals.open({
      modalId: id,
      withCloseButton: false,
      centered: true,
      radius: 'lg',
      padding: 'lg',
      size: 340,
      children: (
        <UserCard username={username} onNavigate={() => modals.close(id)} />
      ),
    });
  };

  return (
    <UnstyledButton
      onClick={openCard}
      className={classes.wrap}
      aria-label={`View ${username}'s profile`}
    >
      <UserAvatar username={username} avatar={avatar} size={size} />
      {withBadge && !isSelf && (
        <span className={classes.badge} aria-hidden>
          <IconPlus size={11} stroke={3.5} />
        </span>
      )}
    </UnstyledButton>
  );
}
