import { HoverCard } from '@mantine/core';

import { UserCard } from '../UserCard/UserCard.tsx';

type UserHoverCardProps = {
  username: string;
  children: React.ReactNode;
};

// Hover preview for usernames (avatars use UserAvatarButton's click modal
// instead). Both render the same Threads-style UserCard.
export function UserHoverCard({ username, children }: UserHoverCardProps) {
  return (
    <HoverCard
      width={320}
      shadow="xl"
      withArrow
      openDelay={300}
      radius="lg"
      position="bottom-start"
    >
      <HoverCard.Target>{children}</HoverCard.Target>
      <HoverCard.Dropdown
        p="lg"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <UserCard username={username} />
      </HoverCard.Dropdown>
    </HoverCard>
  );
}
