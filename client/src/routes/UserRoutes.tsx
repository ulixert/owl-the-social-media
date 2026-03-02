import { LoaderFunctionArgs, redirect } from 'react-router-dom';

import { Loading } from '@/components/Loading/Loading.tsx';
import { useAuthStore } from '@stores/authStore.ts';

export const UserRoutes = [
  {
    path: 'profile/:tab?',
    loader: ({ params }: LoaderFunctionArgs) => {
      const tab = params.tab == 'replies' ? 'replies' : 'posts';
      const username = useAuthStore.getState().userData?.username;

      if (!username) {
        return redirect('/login');
      }
      return redirect(`/${username}/${tab}`);
    },
    hydrateFallbackElement: <Loading />,
  },
  {
    path: ':username/:tab?',
    async lazy() {
      const { ProfilePage } = await import('../pages/ProfilePage.tsx');
      return { Component: ProfilePage };
    },
    hydrateFallbackElement: <Loading />,
  },
];
