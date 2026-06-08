import { Post } from '@/hooks/usePosts.tsx';
import { Group } from '@mantine/core';
import {
  IconHeart,
  IconMessageCircle,
  IconRepeat,
  IconSend,
} from '@tabler/icons-react';
import { useAuthStore } from '@stores/authStore.ts';
import { useOpenLoginModal } from '@/hooks/useOpenLoginModal.tsx';
import { copyToClipboard } from '@/utils/copyToClipboard.ts';
import {
  showErrorNotification,
  showSuccessNotification,
} from '@/utils/showNotification.tsx';

import { useCreatePostModal } from '../hooks/useCreatePostModal.tsx';
import { PostAction } from './PostAction.tsx';
import classes from './PostActions.module.css';
import { useLikeMutation } from '../hooks/useLikeMutation.ts';
import { useRepostMutation } from '../hooks/useRepostMutation.ts';

type ActionsProps = {
  post: Post;
};

export function PostActions({ post }: ActionsProps) {
  const { openCreatePostModal } = useCreatePostModal();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openLoginModal = useOpenLoginModal();
  const likeMutation = useLikeMutation(post.id);
  const repostMutation = useRepostMutation(post.id);

  const handleProtectedAction = (action: () => void) => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    action();
  };

  // Share is just "copy link" — no auth needed. Prefer the async Clipboard API,
  // fall back to a hidden-textarea execCommand for contexts where it's blocked.
  const handleShare = async () => {
    const url = `${window.location.origin}/posts/${post.id}`;
    const copied = await copyToClipboard(url);
    if (copied) {
      showSuccessNotification({
        title: 'Link copied',
        message: 'Post link copied to your clipboard.',
      });
    } else {
      showErrorNotification({
        title: 'Error',
        message: 'Could not copy the link.',
      });
    }
  };

  return (
    <Group ml={-8} gap={2}>
      <PostAction
        label="Like"
        count={post.likesCount}
        onClick={() => handleProtectedAction(() => likeMutation.mutate())}
      >
        <IconHeart className={post.isLiked ? classes.liked : ''} />
      </PostAction>

      <PostAction
        label="Reply"
        count={post.commentsCount}
        onClick={() =>
          handleProtectedAction(() => {
            openCreatePostModal(post);
          })
        }
      >
        <IconMessageCircle />
      </PostAction>

      <PostAction
        label="Repost"
        count={post.repostsCount}
        onClick={() => handleProtectedAction(() => repostMutation.mutate())}
      >
        <IconRepeat className={post.isReposted ? classes.reposted : ''} />
      </PostAction>

      <PostAction label="Share" onClick={() => void handleShare()}>
        <IconSend />
      </PostAction>
    </Group>
  );
}
