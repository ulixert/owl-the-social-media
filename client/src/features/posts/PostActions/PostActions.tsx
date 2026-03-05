import { useState } from 'react';

import { Post } from '@/hooks/usePosts.tsx';
import { Center, Group, Text } from '@mantine/core';
import {
  IconHeart,
  IconMessageCircle,
  IconRepeat,
  IconSend,
} from '@tabler/icons-react';
import { useAuthStore } from '@stores/authStore.ts';
import { useOpenLoginModal } from '@/hooks/useOpenLoginModal.tsx';

import { useCreatePostModal } from '../hooks/useCreatePostModal.tsx';
import { PostAction } from './PostAction.tsx';
import classes from './PostActions.module.css';

type ActionsProps = {
  post: Post;
};

export function PostActions({ post }: ActionsProps) {
  const [liked, setLiked] = useState(false);
  const currentLikesCount = liked ? post.likesCount + 1 : post.likesCount;
  const { openCreatePostModal } = useCreatePostModal();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openLoginModal = useOpenLoginModal();

  const handleProtectedAction = (action: () => void) => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    action();
  };

  return (
    <Group ml={-6} gap={14}>
      <Center>
        <PostAction
          color="red"
          onClick={() => handleProtectedAction(() => setLiked(!liked))}
          type="like"
        >
          <IconHeart className={liked ? classes.liked : ''} />
        </PostAction>
        <Text className={classes.count}>
          {currentLikesCount === 0 ? '' : currentLikesCount}
        </Text>
      </Center>

      <Center>
        <PostAction
          color="blue"
          type="reply"
          onClick={() =>
            handleProtectedAction(() => {
              openCreatePostModal(post);
            })
          }
        >
          <IconMessageCircle />
        </PostAction>
        <Text className={classes.count}>
          {post.commentsCount === 0 ? '' : post.commentsCount}
        </Text>
      </Center>

      <Center>
        <PostAction
          type="repost"
          color="green"
          onClick={() =>
            handleProtectedAction(() => {
              console.log('repost');
            })
          }
        >
          <IconRepeat />
        </PostAction>
        <Text className={classes.count}>
          {post.repostsCount === 0 ? '' : post.repostsCount}
        </Text>
      </Center>

      <PostAction
        type="share"
        color="yellow"
        onClick={() =>
          handleProtectedAction(() => {
            console.log('share');
          })
        }
      >
        <IconSend />
      </PostAction>
    </Group>
  );
}
