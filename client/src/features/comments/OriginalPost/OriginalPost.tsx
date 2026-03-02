import { Link } from 'react-router-dom';

import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import { getPostTime } from '@/utils/getPostTime.ts';
import { Flex } from '@mantine/core';

import { PostActions } from '../../posts/PostActions/PostActions.tsx';
import { PostContent } from '../../posts/PostContent/PostContent.tsx';
import { PostHeader } from '../../posts/PostHeader/PostHeader.tsx';
import { PostMain } from '../../posts/PostMain/PostMain.tsx';

type OriginalPostProps = {
  username: string;
  avatar: string | null;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  postText?: string;
  postImages?: string;
  postTime: Date;
};

export function OriginalPost({
  username,
  avatar,
  repostsCount,
  likesCount,
  commentsCount,
  postText,
  postImages,
  postTime,
}: OriginalPostProps) {
  return (
    <PostMain>
      <Flex gap={12}>
        <Link to={`/user/${username}`}>
          <UserAvatar username={username} avatar={avatar} />
        </Link>
        <PostHeader
          username={username}
          createdAt={getPostTime(new Date(postTime))}
        />
      </Flex>
      <PostContent postText={postText} postImages={postImages} />
      <PostActions
        likesCount={likesCount}
        repostsCount={repostsCount}
        commentsCount={commentsCount}
      />
    </PostMain>
  );
}
