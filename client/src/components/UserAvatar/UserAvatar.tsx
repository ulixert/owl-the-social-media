import { Avatar } from '@mantine/core';

type AvatarProps = {
  username: string;
  avatar: string | null;
  visibleFrom?: string;
  hiddenFrom?: string;
  size?: string;
};

export function UserAvatar({
  username,
  avatar,
  hiddenFrom,
  size,
  visibleFrom,
}: AvatarProps) {
  return (
    <Avatar
      alt={username}
      src={avatar}
      key={username}
      name={username}
      color="initials"
      allowedInitialsColors={['blue', 'green', 'orange', 'indigo']}
      hiddenFrom={hiddenFrom}
      visibleFrom={visibleFrom}
      size={size}
    />
  );
}
