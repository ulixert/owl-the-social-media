import { createBrowserRouter } from 'react-router-dom';

import { Loading } from '@/components/Loading/Loading.tsx';

import { AuthRoutes } from './AuthRoutes.tsx';
import { PostRoutes } from './PostRoutes.tsx';
import { UserRoutes } from './UserRoutes.tsx';

export const router = createBrowserRouter([
  {
    id: 'root',
    path: '/',
    async lazy() {
      const { AppLayout } = await import('../layouts/AppLayout/AppLayout.tsx');
      return { Component: AppLayout };
    },
    hydrateFallbackElement: <Loading />,
    children: [
      {
        path: '/',
        async lazy() {
          const { HomePage } = await import('../pages/HomePage.tsx');
          return { Component: HomePage };
        },
        hydrateFallbackElement: <Loading />,
      },
      {
        path: '/search',
        async lazy() {
          const { SearchPage } = await import('../pages/SearchPage.tsx');
          return { Component: SearchPage };
        },
      },
      {
        path: '/messages',
        async lazy() {
          const { MessagesPage } = await import('../pages/MessagesPage.tsx');
          return { Component: MessagesPage };
        },
      },
      {
        path: '/activity',
        async lazy() {
          const { ActivityPage } = await import('../pages/ActivityPage.tsx');
          return { Component: ActivityPage };
        },
      },
      ...PostRoutes,
      ...UserRoutes,
    ],
  },
  ...AuthRoutes,
  {
    path: '*',
    async lazy() {
      const { NotFoundPage } = await import('../pages/NotFoundPage.tsx');
      return { Component: NotFoundPage };
    },
    hydrateFallbackElement: <Loading />,
  },
]);
