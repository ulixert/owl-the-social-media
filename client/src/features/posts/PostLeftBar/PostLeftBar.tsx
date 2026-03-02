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
      <Link to={`/user/${username}`}>
        <UserAvatar username={username} avatar={avatar} />
      </Link>
    </Stack>
  );
}
