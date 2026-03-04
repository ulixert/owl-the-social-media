import { Loading } from '@/components/Loading/Loading.tsx';

export const PostRoutes = [
  {
    path: 'hot',
    async lazy() {
      const { PostList } = await import(
        '../features/posts/PostList/PostList.tsx'
      );
      return { Component: PostList };
    },
    hydrateFallbackElement: <Loading />,
  },
  ...['for-you', 'following', 'liked', 'saved'].map((path) => ({
    path,
    async lazy() {
      const { PostList } = await import(
        '../features/posts/PostList/PostList.tsx'
      );
      const { ProtectedRoute } = await import('./ProtectedRoute.tsx');
      return {
        Component: () => (
          <ProtectedRoute>
            <PostList />
          </ProtectedRoute>
        ),
      };
    },
    hydrateFallbackElement: <Loading />,
  })),
  {
    path: 'create',
    async lazy() {
      const { CreatePostPage } = await import('../pages/CreatePostPage.tsx');
      const { ProtectedRoute } = await import('./ProtectedRoute.tsx');
      return {
        Component: () => (
          <ProtectedRoute>
            <CreatePostPage />
          </ProtectedRoute>
        ),
      };
    },
    hydrateFallbackElement: <Loading />,
  },
  {
    path: 'posts/:postId',
    async lazy() {
      const { PostPage } = await import('../pages/PostPage.tsx');
      return { Component: PostPage };
    },
  },
];
