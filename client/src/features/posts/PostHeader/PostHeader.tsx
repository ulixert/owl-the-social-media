import { Link } from 'react-router-dom';

import { Flex, Stack, Text } from '@mantine/core';
import { IconDots } from '@tabler/icons-react';
import { UserHoverCard } from '@/features/user/UserHoverCard/UserHoverCard.tsx';

import classes from './PostHeader.module.css';

type PostHeaderProps = {
  username: string;
  createdAt: string;
  parentPostId?: number | null;
};

export function PostHeader({
  username,
  createdAt,
  parentPostId,
}: PostHeaderProps) {
  return (
    <Stack gap={0} w="100%">
      <Flex justify="space-between" w="100%" align="flex-start">
        <Flex w="100%" align="center" gap={10}>
          <UserHoverCard username={username}>
            <Link
              to={`/user/${username}`}
              className={classes.username}
              onClick={(e) => e.stopPropagation()}
            >
              <Text size="sm" fw="600">
                {username}
              </Text>
            </Link>
          </UserHoverCard>
          <Text size="sm" c="gray.6">
            {createdAt}
          </Text>
        </Flex>

        <Flex align="center">
          <IconDots cursor="pointer" />
        </Flex>
      </Flex>
      {parentPostId && (
        <Text size="xs" c="dimmed">
          Replying to a post
        </Text>
      )}
    </Stack>
  );
}
