import { Link } from 'react-router-dom';

import { Flex, Text } from '@mantine/core';
import { IconDots } from '@tabler/icons-react';

import classes from './PostHeader.module.css';

type PostHeaderProps = {
  username: string;
  createdAt: string;
};

export function PostHeader({ username, createdAt }: PostHeaderProps) {
  return (
    <Flex justify="space-between" w="100%" align="flex-start">
      <Flex w="100%" align="center" gap={10}>
        <Link to={`/user/${username}`} className={classes.username}>
          <Text size="sm" fw="600">
            {username}
          </Text>
        </Link>
        <Text size="sm" c="gray.6">
          {createdAt}
        </Text>
      </Flex>

      <Flex align="center">
        <IconDots cursor="pointer" />
      </Flex>
    </Flex>
  );
}
