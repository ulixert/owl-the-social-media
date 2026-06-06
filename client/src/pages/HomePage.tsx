import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { PostList } from '@/features/posts/PostList/PostList.tsx';
import { useTitleStore } from '@stores/titleStore.ts';

export function HomePage() {
  const setTitle = useTitleStore((state) => state.setTitle);
  const location = useLocation();

  useEffect(() => {
    // '/' and '/for-you' are the same feed; only '/following' differs.
    setTitle(location.pathname === '/following' ? 'Following' : 'For you');
  }, [setTitle, location.pathname]);

  return <PostList />;
}
