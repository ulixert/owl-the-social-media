import { Link, useNavigate } from 'react-router-dom';

import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
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
};

export function OriginalPost({ post }: OriginalPostProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    // If the click was on a link (avatar) or an action button, don't navigate
    if ((e.target as HTMLElement).closest('a, button')) {
      return;
    }
    void navigate(`/posts/${post.id}`);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/posts/${post.id}`)}
      className={classes.originalPost}
    >
      <PostMain>
        <Flex gap={12}>
          <Link
            to={`/user/${post.postedBy.username}`}
            className={classes.avatar}
          >
            <UserAvatar
              username={post.postedBy.username}
              avatar={post.postedBy.profilePic}
            />
          </Link>
          <PostHeader
            username={post.postedBy.username}
            createdAt={getPostTime(new Date(post.createdAt))}
            parentPostId={post.parentPostId}
          />
        </Flex>
        <PostContent postText={post.text} postImages={post.images} />
        <PostActions post={post} />
      </PostMain>
    </div>
  );
}
