import { useNavigate } from 'react-router-dom';

import { getPostTime } from '@/utils/getPostTime.ts';
import { Divider, Flex } from '@mantine/core';

import { PostActions } from '../PostActions/PostActions.tsx';
import { PostContent } from '../PostContent/PostContent.tsx';
import { PostHeader } from '../PostHeader/PostHeader.tsx';
import { PostLeftBar } from '../PostLeftBar/PostLeftBar.tsx';
import { PostMain } from '../PostMain/PostMain.tsx';
import classes from './PostItem.module.css';

type PostProps = {
  postId: number;
  postText?: string;
  postImages?: string;
  postTime: Date;
  postAuthor: string;
  postAuthorId: number;
  postAuthorAvatar: string | null;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
};

export function PostItem({
  postImages,
  postText,
  postId,
  postTime,
  postAuthor,
  postAuthorAvatar,
  likesCount,
  commentsCount,
  repostsCount,
}: PostProps) {
  const navigate = useNavigate();
  return (
    <>
      <div
        role="link"
        tabIndex={0}
        onClick={() => navigate(`/posts/${postId}`)}
        onKeyDown={(e) => e.key === 'Enter' && navigate(`/posts/${postId}`)}
        className={classes.post}
      >
        <Flex gap={12}>
          <PostLeftBar username={postAuthor} avatar={postAuthorAvatar} />

          <PostMain>
            <PostHeader
              createdAt={getPostTime(new Date(postTime))}
              username={postAuthor}
            />
            <PostContent postText={postText} postImages={postImages} />
            <PostActions
              likesCount={likesCount}
              commentsCount={commentsCount}
              repostsCount={repostsCount}
            />
          </PostMain>
        </Flex>
      </div>

      <Divider className={classes.divider} />
    </>
  );
}
