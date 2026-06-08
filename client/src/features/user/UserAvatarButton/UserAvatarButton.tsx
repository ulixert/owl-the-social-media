import { useNavigate } from 'react-router-dom';

import { UnstyledButton } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useAuthStore } from '@stores/authStore.ts';
import { useFollowBadgeStore } from '@stores/followBadgeStore.ts';
import { IconCheck, IconPlus } from '@tabler/icons-react';

import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import { useFollowingIds } from '@/hooks/useFollowingIds.ts';
import { UserCard } from '../UserCard/UserCard.tsx';
import classes from './UserAvatarButton.module.css';

type UserAvatarButtonProps = {
  userId: number;
  username: string;
  avatar: string | null;
  size?: string;
  // Hide the badge where a separate follow button already exists (e.g. user
  // list rows).
  withBadge?: boolean;
};

// Avatar that opens the Threads-style profile card in a modal on click (replaces
// the old hover-to-show-card behaviour). The badge mirrors Threads:
//   - not following  → "+"
//   - just followed this session → "✓"
//   - already following (steady state, e.g. after reload) → no badge
export function UserAvatarButton({
  userId,
  username,
  avatar,
  size,
  withBadge = true,
}: UserAvatarButtonProps) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.userData);
  const isSelf = currentUser?.username === username;

  const { data: followingIds } = useFollowingIds();
  const justFollowed = useFollowBadgeStore((state) =>
    state.justFollowed.has(userId),
  );
  const isFollowing = followingIds?.includes(userId) ?? false;

  // null = no badge.
  const badge: 'follow' | 'followed' | null =
    isSelf || !withBadge
      ? null
      : justFollowed
        ? 'followed'
        : isFollowing
          ? null
          : 'follow';

  const handleClick = (e: React.MouseEvent) => {
    // Sit inside a post (which navigates on click) — don't bubble to it.
    e.preventDefault();
    e.stopPropagation();

    // No badge means there's no follow action to offer (already following, your
    // own avatar, or a list row) — go straight to the profile. Otherwise open
    // the card modal so you can follow from there.
    if (!badge) {
      void navigate(`/user/${username}`);
      return;
    }

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
      onClick={handleClick}
      className={classes.wrap}
      aria-label={`View ${username}'s profile`}
    >
      <UserAvatar username={username} avatar={avatar} size={size} />
      {badge && (
        <span className={classes.badge} aria-hidden>
          {badge === 'followed' ? (
            <IconCheck size={11} stroke={3.5} />
          ) : (
            <IconPlus size={11} stroke={3.5} />
          )}
        </span>
      )}
    </UnstyledButton>
  );
}
