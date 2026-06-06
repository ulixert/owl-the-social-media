import { useNavigate, useParams } from 'react-router-dom';

import { Loading } from '@/components/Loading/Loading.tsx';
import { PostList } from '@/features/posts/PostList/PostList.tsx';
import { UserHeader } from '@/features/user/UserHeader/UserHeader.tsx';
import { useUserProfile } from '@/hooks/useUserProfile.ts';

export function ProfilePage() {
  const navigate = useNavigate();
  const { tab, username } = useParams<{ username: string; tab?: string }>();
  const activeTab = tab == 'replies' ? 'replies' : 'posts';

  const { data: user, isLoading, isError } = useUserProfile(username);

  if (isLoading) {
    return <Loading />;
  }

  if (isError || user == null) {
    return <div>User not found</div>;
  }

  const endpoint =
    activeTab == 'posts'
      ? `/user/${username}/posts`
      : `/user/${username}/replies`;

  return (
    <>
      <UserHeader
        tab={activeTab}
        // Stay on the profile being viewed. `/profile/...` redirects to the
        // logged-in user, so switching tabs on someone else's profile would
        // otherwise bounce to your own.
        onTabChange={(tab) => navigate(`/user/${username}/${tab}`)}
        user={user}
      />
      <PostList endpoint={endpoint} />
    </>
  );
}
