import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { axiosInstance } from '@/api/axiosConfig.ts';
import { Post } from '@/hooks/usePosts.tsx';
import { SearchUser, UserItem } from '@/features/user/UserItem/UserItem.tsx';
import { PostItem } from '@/features/posts/PostItem/PostItem.tsx';
import { Box, Center, Loader, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';
import { useTitleStore } from '@stores/titleStore.ts';
import { useAuthStore } from '@stores/authStore.ts';
import { useDebouncedValue } from '@mantine/hooks';

type UserSearchResponse = {
  users: SearchUser[];
  nextCursor?: number | null;
};

type PostSearchResponse = {
  posts: Post[];
  nextCursor: number | null;
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Text fw={700} size="sm" c="dimmed" px="md" py="sm">
      {children}
    </Text>
  );
}

export function SearchPage() {
  const setTitle = useTitleStore((state) => state.setTitle);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const isSearching = debouncedQuery.length > 0;

  useEffect(() => {
    setTitle('Explore');
  }, [setTitle]);

  // --- Idle (explore): who to follow + trending posts ---
  const { data: recommended } = useQuery({
    queryKey: ['recommendedUsers', isAuthenticated],
    queryFn: async () =>
      (await axiosInstance.get<UserSearchResponse>('users/recommended')).data,
    enabled: !isSearching,
  });

  const { data: trending } = useQuery({
    queryKey: ['trendingPosts', isAuthenticated],
    queryFn: async () =>
      (
        await axiosInstance.get<PostSearchResponse>('posts/trending', {
          params: { limit: 15 },
        })
      ).data,
    enabled: !isSearching,
  });

  // --- Searching: top matching accounts + an infinite post feed ---
  const { data: userMatches, isLoading: loadingUsers } = useQuery({
    queryKey: ['search', 'users', debouncedQuery, isAuthenticated],
    queryFn: async () =>
      (
        await axiosInstance.get<UserSearchResponse>('posts/search/users', {
          params: { q: debouncedQuery },
        })
      ).data,
    enabled: isSearching,
  });

  const {
    data: postMatches,
    fetchNextPage,
    hasNextPage,
    isFetching: isFetchingPosts,
    isLoading: loadingPosts,
  } = useInfiniteQuery({
    queryKey: ['search', 'posts', debouncedQuery, isAuthenticated],
    queryFn: async ({ pageParam }): Promise<PostSearchResponse> =>
      (
        await axiosInstance.get<PostSearchResponse>('posts/search/posts', {
          params: { q: debouncedQuery, cursor: pageParam || undefined },
        })
      ).data,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: isSearching,
  });

  const { ref, inView } = useInView();
  useEffect(() => {
    if (inView && hasNextPage) void fetchNextPage();
  }, [inView, hasNextPage, fetchNextPage]);

  const users = userMatches?.users ?? [];
  const posts = postMatches?.pages.flatMap((page) => page.posts) ?? [];

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
              backgroundColor:
                'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))',
              border: 'none',
            },
          }}
        />
      </Box>

      {!isSearching ? (
        // Explore: trending first, then a few suggestions (Threads-style)
        <Stack gap={0}>
          <SectionHeader>Trending</SectionHeader>
          <Stack gap="md" px="md" pb="md">
            {trending?.posts.length ? (
              trending.posts.map((post) => <PostItem key={post.id} post={post} />)
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                Nothing trending yet — check back soon.
              </Text>
            )}
          </Stack>

          {(recommended?.users.length ?? 0) > 0 && (
            <>
              <SectionHeader>Suggested for you</SectionHeader>
              <Stack gap={0}>
                {recommended?.users.slice(0, 5).map((user) => (
                  <UserItem key={user.id} user={user} />
                ))}
              </Stack>
            </>
          )}
        </Stack>
      ) : (
        // Search results: accounts, then posts — one scroll, no tabs
        <Stack gap={0}>
          <SectionHeader>Accounts</SectionHeader>
          {loadingUsers ? (
            <Center py="md">
              <Loader size="sm" />
            </Center>
          ) : users.length > 0 ? (
            <Stack gap={0}>
              {users.map((user) => (
                <UserItem key={user.id} user={user} />
              ))}
            </Stack>
          ) : (
            <Text c="dimmed" px="md" pb="sm">
              No accounts found
            </Text>
          )}

          <SectionHeader>Posts</SectionHeader>
          <Stack gap="md" px="md">
            {posts.map((post) => (
              <PostItem key={post.id} post={post} />
            ))}
            {!loadingPosts && posts.length === 0 && (
              <Text c="dimmed" ta="center" py="md">
                No posts found
              </Text>
            )}
          </Stack>

          {hasNextPage && (
            <div ref={ref}>
              {isFetchingPosts && (
                <Center py="md">
                  <Loader size="xs" />
                </Center>
              )}
            </div>
          )}
        </Stack>
      )}
    </Stack>
  );
}
