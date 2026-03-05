import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { axiosInstance } from '@/api/axiosConfig.ts';
import { Post } from '@/hooks/usePosts.tsx';
import { SearchUser, UserItem } from '@/features/user/UserItem/UserItem.tsx';
import { PostItem } from '@/features/posts/PostItem/PostItem.tsx';
import {
  Box,
  Center,
  Loader,
  Stack,
  Tabs,
  TextInput,
  Text,
} from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';
import { useTitleStore } from '@stores/titleStore.ts';
import { useAuthStore } from '@stores/authStore.ts';
import { useDebouncedValue } from '@mantine/hooks';

import classes from './HomePage.module.css';

type UserSearchResponse = {
  users: SearchUser[];
  nextCursor: number | null;
};

type PostSearchResponse = {
  posts: Post[];
  nextCursor: number | null;
};

export function SearchPage() {
  const setTitle = useTitleStore((state) => state.setTitle);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const [activeTab, setActiveTab] = useState<string | null>('users');

  useEffect(() => {
    setTitle('Search');
  }, [setTitle]);

  const {
    data: userData,
    fetchNextPage: fetchNextUsers,
    hasNextPage: hasMoreUsers,
    isFetching: isFetchingUsers,
    isLoading: isLoadingUsers,
  } = useInfiniteQuery({
    queryKey: ['search', 'users', debouncedQuery, isAuthenticated],
    queryFn: async ({ pageParam }): Promise<UserSearchResponse> => {
      const response = await axiosInstance.get<UserSearchResponse>(
        'posts/search/users',
        {
          params: { q: debouncedQuery, cursor: pageParam || undefined },
        },
      );
      return response.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: debouncedQuery.length > 0 && activeTab === 'users',
  });

  const {
    data: postData,
    fetchNextPage: fetchNextPosts,
    hasNextPage: hasMorePosts,
    isFetching: isFetchingPosts,
    isLoading: isLoadingPosts,
  } = useInfiniteQuery({
    queryKey: ['search', 'posts', debouncedQuery, isAuthenticated],
    queryFn: async ({ pageParam }): Promise<PostSearchResponse> => {
      const response = await axiosInstance.get<PostSearchResponse>(
        'posts/search/posts',
        {
          params: { q: debouncedQuery, cursor: pageParam || undefined },
        },
      );
      return response.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: debouncedQuery.length > 0 && activeTab === 'posts',
  });

  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView) {
      if (activeTab === 'users' && hasMoreUsers) {
        void fetchNextUsers();
      } else if (activeTab === 'posts' && hasMorePosts) {
        void fetchNextPosts();
      }
    }
  }, [inView, activeTab, hasMoreUsers, hasMorePosts, fetchNextUsers, fetchNextPosts]);

  return (
    <Stack gap={0}>
      <Box p="md">
        <TextInput
          placeholder="Search"
          leftSection={<IconSearch size={18} />}
          rightSection={
            query && (
              <IconX
                size={18}
                style={{ cursor: 'pointer' }}
                onClick={() => setQuery('')}
              />
            )
          }
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          radius="xl"
          size="md"
          autoFocus
          styles={{
            input: {
              backgroundColor: 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))',
              border: 'none',
            },
          }}
        />
      </Box>

      <Tabs value={activeTab} onChange={setActiveTab} variant="default">
        <Tabs.List grow>
          <Tabs.Tab value="users" fw={600} className={classes.tab} py={12}>
            Users
          </Tabs.Tab>
          <Tabs.Tab value="posts" fw={600} className={classes.tab} py={12}>
            Posts
          </Tabs.Tab>
        </Tabs.List>

        <Box p="md">
          {debouncedQuery.length === 0 ? (
            <Center mt="xl">
              <Text c="dimmed">Try searching for people or posts</Text>
            </Center>
          ) : (
            <>
              {activeTab === 'users' && (
                <Stack gap={0}>
                  {userData?.pages.map((page) =>
                    page.users.map((user) => <UserItem key={user.id} user={user} />),
                  )}
                  {isLoadingUsers && (
                    <Center py="xl">
                      <Loader size="sm" />
                    </Center>
                  )}
                  {!isLoadingUsers && userData?.pages[0].users.length === 0 && (
                    <Center py="xl">
                      <Text c="dimmed">No users found</Text>
                    </Center>
                  )}
                </Stack>
              )}

              {activeTab === 'posts' && (
                <Stack gap="md">
                  {postData?.pages.map((page) =>
                    page.posts.map((post) => <PostItem key={post.id} post={post} />),
                  )}
                  {isLoadingPosts && (
                    <Center py="xl">
                      <Loader size="sm" />
                    </Center>
                  )}
                  {!isLoadingPosts && postData?.pages[0].posts.length === 0 && (
                    <Center py="xl">
                      <Text c="dimmed">No posts found</Text>
                    </Center>
                  )}
                </Stack>
              )}

              {(hasMoreUsers || hasMorePosts) && (
                <div ref={ref}>
                  {(isFetchingUsers || isFetchingPosts) && (
                    <Center py="md">
                      <Loader size="xs" />
                    </Center>
                  )}
                </div>
              )}
            </>
          )}
        </Box>
      </Tabs>
    </Stack>
  );
}
