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
  // On a post's detail page every reply is to the same post, so the
  // "> parent" context is redundant and hidden.
  hideReplyContext?: boolean;
  // Draw the thread-line connector below the avatar (links the post to the one
  // rendered flush below it in a chain).
  connectBottom?: boolean;
  // Suppress the trailing divider (chained ancestors connect via the line).
  hideDivider?: boolean;
};

export function PostItem({
  post,
  hideReplyContext,
  connectBottom,
  hideDivider,
}: PostProps) {
  const navigate = useNavigate();
  // Chained ancestors (connector + no divider) get bottom padding so the line
  // has room to run down to the next avatar.
  const isChained = connectBottom && hideDivider;
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
            connectBottom={connectBottom}
          />

          <PostMain pb={isChained ? 12 : undefined}>
            <PostHeader
              createdAt={getPostTime(new Date(post.createdAt))}
              post={post}
              replyToUsername={
                hideReplyContext ? undefined : post.parentPost?.postedBy.username
              }
            />
            <PostContent postText={post.text} postImages={post.images} />
            <PostActions post={post} />
          </PostMain>
        </Flex>
      </div>

      {!hideDivider && <Divider className={classes.divider} />}
    </>
  );
}
