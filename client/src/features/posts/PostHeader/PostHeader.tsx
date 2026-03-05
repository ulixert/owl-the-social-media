import { Link } from 'react-router-dom';

import { Flex, Stack, Text } from '@mantine/core';
import { IconDots } from '@tabler/icons-react';
import { UserHoverCard } from '@/features/user/UserHoverCard/UserHoverCard.tsx';

import classes from './PostHeader.module.css';

type PostHeaderProps = {
  username: string;
  name: string;
  createdAt: string;
  replyToUsername?: string | null;
};

export function PostHeader({
  username,
  name,
  createdAt,
  replyToUsername,
}: PostHeaderProps) {
  return (
    <Stack gap={0} w="100%">
      <Flex justify="space-between" w="100%" align="flex-start">
        <Flex w="100%" align="center" gap={6}>
          <UserHoverCard username={username}>
            <Link
              to={`/user/${username}`}
              className={classes.username}
              onClick={(e) => e.stopPropagation()}
            >
              <Text size="sm" fw="700" span>
                {name}
              </Text>
              <Text size="sm" c="gray.6" span ml={4}>
                @{username}
              </Text>
            </Link>
          </UserHoverCard>
          <Text size="sm" c="gray.6">
            &bull;
          </Text>
          <Text size="sm" c="gray.6">
            {createdAt}
          </Text>
        </Flex>

        <Flex align="center">
          <IconDots cursor="pointer" size={18} />
        </Flex>
      </Flex>
      {replyToUsername && (
        <Text size="xs" c="dimmed">
          Replying to{' '}
          <UserHoverCard username={replyToUsername}>
            <Link
              to={`/user/${replyToUsername}`}
              style={{ textDecoration: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Text span c="blue.6">
                @{replyToUsername}
              </Text>
            </Link>
          </UserHoverCard>
        </Text>
      )}
    </Stack>
  );
}
