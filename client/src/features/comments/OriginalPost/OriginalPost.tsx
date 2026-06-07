import { useLocation, useNavigate } from 'react-router-dom';

import { UserAvatarButton } from '@/features/user/UserAvatarButton/UserAvatarButton.tsx';
import { Post } from '@/hooks/usePosts.tsx';
import { getPostTime } from '@/utils/getPostTime.ts';
import { Flex } from '@mantine/core';

import { PostActions } from '../../posts/PostActions/PostActions.tsx';
import { PostContent } from '../../posts/PostContent/PostContent.tsx';
import { PostHeader } from '../../posts/PostHeader/PostHeader.tsx';
import { PostMain } from '../../posts/PostMain/PostMain.tsx';
import classes from './OriginalPost.module.css';

type OriginalPostProps = {
  post: Post;
  // When the ancestor chain is shown above this post, the inline "> parent"
  // context is redundant.
  hideReplyContext?: boolean;
};

export function OriginalPost({ post, hideReplyContext }: OriginalPostProps) {
  const navigate = useNavigate();
  const location = useLocation();
  // The post whose detail page we're already on — clicking it shouldn't
  // re-navigate to itself (that just stacks history). Parent posts and replies
  // have a different id, so they still navigate normally.
  const isCurrent = location.pathname === `/posts/${post.id}`;

  const handleClick = (e: React.MouseEvent) => {
    // If the click was on a link (avatar) or an action button, don't navigate
    if ((e.target as HTMLElement).closest('a, button')) {
      return;
    }
    if (isCurrent) return;
    // Always on a post detail page here, so replace (see PostItem) to keep Back
    // returning to the feed rather than stacking post→post entries.
    void navigate(`/posts/${post.id}`, { replace: true });
  };

  if (post.isDeleted) {
    return (
      <div className={classes.originalPost} style={{ cursor: 'default' }}>
        <PostMain>
          <PostContent postText="This post has been deleted." postImages={[]} />
        </PostMain>
      </div>
    );
  }

  return (
    <div
      role={isCurrent ? undefined : 'link'}
      tabIndex={isCurrent ? undefined : 0}
      onClick={handleClick}
      onKeyDown={(e) =>
        !isCurrent &&
        e.key === 'Enter' &&
        navigate(`/posts/${post.id}`, { replace: true })
      }
      className={classes.originalPost}
      style={isCurrent ? { cursor: 'default' } : undefined}
    >
      <PostMain>
        <Flex gap={12}>
          <UserAvatarButton
            username={post.postedBy.username}
            avatar={post.postedBy.profilePic}
          />
          <PostHeader
            post={post}
            createdAt={getPostTime(new Date(post.createdAt))}
            replyToUsername={
              hideReplyContext ? undefined : post.parentPost?.postedBy.username
            }
          />
        </Flex>
        <PostContent postText={post.text} postImages={post.images} />
        <PostActions post={post} />
      </PostMain>
    </div>
  );
}
