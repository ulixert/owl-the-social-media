import { Link } from 'react-router-dom';

import { Flex, Stack, Text } from '@mantine/core';
import { UserHoverCard } from '@/features/user/UserHoverCard/UserHoverCard.tsx';
import { useAuthStore } from '@stores/authStore.ts';
import { Post } from '@/hooks/usePosts.tsx';
import { PostMoreMenu } from '../PostActions/PostMoreMenu.tsx';

import classes from './PostHeader.module.css';

type PostHeaderProps = {
  post: Post;
  createdAt: string;
  replyToUsername?: string | null;
};

export function PostHeader({
  post,
  createdAt,
  replyToUsername,
}: PostHeaderProps) {
  const currentUser = useAuthStore((state) => state.userData);
  const isOwner = currentUser?.userId === post.postedBy.id;

  return (
    <Stack gap={0} w="100%">
      <Flex justify="space-between" w="100%" align="flex-start">
        <Flex w="100%" align="center" gap={6} style={{ minWidth: 0 }}>
          <UserHoverCard username={post.postedBy.username}>
            <Link
              to={`/user/${post.postedBy.username}`}
              className={classes.username}
              onClick={(e) => e.stopPropagation()}
            >
              <Text size="sm" fw="700" span truncate>
                {post.postedBy.name}
              </Text>
              <Text size="sm" c="gray.6" span ml={4} truncate>
                @{post.postedBy.username}
              </Text>
            </Link>
          </UserHoverCard>
          <Text size="sm" c="gray.6">
            &bull;
          </Text>
          <Text size="sm" c="gray.6" style={{ whiteSpace: 'nowrap' }}>
            {createdAt}
          </Text>
        </Flex>

        <Flex align="center">
          <PostMoreMenu post={post} isOwner={isOwner} />
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
