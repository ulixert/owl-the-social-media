import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { PostList } from '@/features/posts/PostList/PostList.tsx';
import { useAuthStore } from '@stores/authStore.ts';
import { useTitleStore } from '@stores/titleStore.ts';

export function HomePage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setTitle = useTitleStore((state) => state.setTitle);
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/') {
      setTitle(isAuthenticated ? 'For You' : 'Home');
    } else if (location.pathname === '/following') {
      setTitle('Following');
    } else if (location.pathname === '/for-you') {
      setTitle('For You');
    }
  }, [isAuthenticated, setTitle, location.pathname]);

  return <PostList />;
}
