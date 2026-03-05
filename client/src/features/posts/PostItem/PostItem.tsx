import { useNavigate } from 'react-router-dom';

import { Post } from '@/hooks/usePosts.tsx';
import { getPostTime } from '@/utils/getPostTime.ts';
import { Divider, Flex } from '@mantine/core';

import { PostActions } from '../PostActions/PostActions.tsx';
import { PostContent } from '../PostContent/PostContent.tsx';
import { PostHeader } from '../PostHeader/PostHeader.tsx';
import { PostLeftBar } from '../PostLeftBar/PostLeftBar.tsx';
import { PostMain } from '../PostMain/PostMain.tsx';
import classes from './PostItem.module.css';

type PostProps = {
  post: Post;
};

export function PostItem({ post }: PostProps) {
  const navigate = useNavigate();
  return (
    <>
      <div
        role="link"
        tabIndex={0}
        onClick={() => navigate(`/posts/${post.id}`)}
        onKeyDown={(e) => e.key === 'Enter' && navigate(`/posts/${post.id}`)}
        className={classes.post}
      >
        <Flex gap={12}>
          <PostLeftBar
            username={post.postedBy.username}
            avatar={post.postedBy.profilePic}
          />

          <PostMain>
            <PostHeader
              createdAt={getPostTime(new Date(post.createdAt))}
              post={post}
              replyToUsername={post.parentPost?.postedBy.username}
            />
            <PostContent postText={post.text} postImages={post.images} />
            <PostActions post={post} />
          </PostMain>
        </Flex>
      </div>

      <Divider className={classes.divider} />
    </>
  );
}
