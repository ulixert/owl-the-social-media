import { Link } from 'react-router-dom';

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
  return (
    <PostMain>
      <Flex gap={12}>
        <Link to={`/user/${post.postedBy.username}`} className={classes.avatar}>
          <UserAvatar
            username={post.postedBy.username}
            avatar={post.postedBy.profilePic}
          />
        </Link>
        <PostHeader
          username={post.postedBy.username}
          createdAt={getPostTime(new Date(post.createdAt))}
        />
      </Flex>
      <PostContent postText={post.text} postImages={post.images} />
      <PostActions post={post} />
    </PostMain>
  );
}
