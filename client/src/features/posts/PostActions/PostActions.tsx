import { useState } from 'react';

import { Post } from '@/hooks/usePosts.tsx';
import { Center, Group, Text } from '@mantine/core';
import {
  IconHeart,
  IconMessageCircle,
  IconRepeat,
  IconSend,
} from '@tabler/icons-react';

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

  return (
    <Group ml={-6} gap={14}>
      <Center>
        <PostAction color="red" onClick={() => setLiked(!liked)} type="like">
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
          onClick={() => {
            openCreatePostModal(post);
          }}
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
          onClick={() => {
            console.log('repost');
          }}
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
        onClick={() => {
          console.log('share');
        }}
      >
        <IconSend />
      </PostAction>
    </Group>
  );
}
