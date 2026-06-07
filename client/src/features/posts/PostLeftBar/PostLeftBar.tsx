import { Link } from 'react-router-dom';

import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import { UserHoverCard } from '@/features/user/UserHoverCard/UserHoverCard.tsx';
import { Stack } from '@mantine/core';

import classes from './PostLeftBar.module.css';

type PostLeftBarProps = {
  username: string;
  avatar: string | null;
  // Thread-line connectors in the avatar column. `connectBottom` fills the rest
  // of the row below the avatar (links down to the next post when the chain is
  // rendered flush); `connectTop` is a short stub above the avatar.
  connectTop?: boolean;
  connectBottom?: boolean;
};

export function PostLeftBar({
  username,
  avatar,
  connectTop,
  connectBottom,
}: PostLeftBarProps) {
  return (
    <Stack align="center" gap={0} className={classes.column}>
      {connectTop && <div className={classes.lineTop} />}
      <UserHoverCard username={username}>
        <Link
          to={`/user/${username}`}
          onClick={(e) => e.stopPropagation()}
          className={classes.post}
        >
          <UserAvatar username={username} avatar={avatar} />
        </Link>
      </UserHoverCard>
      {connectBottom && <div className={classes.line} />}
    </Stack>
  );
}
