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
import { useLikeMutation } from '../hooks/useLikeMutation.ts';

type ActionsProps = {
  post: Post;
};

export function PostActions({ post }: ActionsProps) {
  const { openCreatePostModal } = useCreatePostModal();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openLoginModal = useOpenLoginModal();
  const likeMutation = useLikeMutation(post.id);

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
          onClick={() => handleProtectedAction(() => likeMutation.mutate())}
          type="like"
        >
          <IconHeart className={post.isLiked ? classes.liked : ''} />
        </PostAction>
        <Text className={classes.count}>
          {post.likesCount === 0 ? '' : post.likesCount}
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
