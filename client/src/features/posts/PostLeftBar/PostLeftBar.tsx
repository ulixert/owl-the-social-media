import { Link } from 'react-router-dom';

import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import { Stack } from '@mantine/core';
import { UserHoverCard } from '@/features/user/UserHoverCard/UserHoverCard.tsx';

import classes from './PostLeftBar.module.css';

type PostLeftBarProps = {
  username: string;
  avatar: string | null;
};

export function PostLeftBar({ username, avatar }: PostLeftBarProps) {
  return (
    <Stack align="center">
      <UserHoverCard username={username}>
        <Link
          to={`/user/${username}`}
          onClick={(e) => e.stopPropagation()}
          className={classes.post}
        >
          <UserAvatar username={username} avatar={avatar} />
        </Link>
      </UserHoverCard>
    </Stack>
  );
}
