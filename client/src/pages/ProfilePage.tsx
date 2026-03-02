import { useNavigate, useParams } from 'react-router-dom';

import { PostList } from '@/features/posts/PostList/PostList.tsx';
import { UserHeader } from '@/features/user/UserHeader/UserHeader.tsx';

export function ProfilePage() {
  const navigate = useNavigate();
  const { tab, username } = useParams<{ username: string; tab?: string }>();

  const activeTab = tab == 'replies' ? 'replies' : 'posts';
  const endpoint =
    activeTab == 'posts'
      ? `/user/${username}/posts`
      : `/user/${username}/replies`;

  return (
    <>
      <UserHeader
        tab={activeTab}
        onTabChange={(tab) => navigate(`/profile/${tab}`)}
      />
      <PostList endpoint={endpoint} />
    </>
  );
}
