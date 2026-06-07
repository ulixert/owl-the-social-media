import { UserAvatarButton } from '@/features/user/UserAvatarButton/UserAvatarButton.tsx';
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
      <UserAvatarButton username={username} avatar={avatar} />
      {connectBottom && <div className={classes.line} />}
    </Stack>
  );
}
