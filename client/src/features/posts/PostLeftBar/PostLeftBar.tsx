import { Link } from 'react-router-dom';

import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import { Stack } from '@mantine/core';

type PostLeftBarProps = {
  username: string;
  avatar: string | null;
};

export function PostLeftBar({ username, avatar }: PostLeftBarProps) {
  return (
    <Stack align="center">
      <Link to={`/user/${username}`} onClick={(e) => e.stopPropagation()}>
        <UserAvatar username={username} avatar={avatar} />
      </Link>
    </Stack>
  );
}
