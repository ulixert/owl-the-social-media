import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { CreatePost } from '@/features/posts/CreatePost/CreatePost';
import { Box, Container } from '@mantine/core';
import { useTitleStore } from '@stores/titleStore';

export function CreatePostPage() {
  const navigate = useNavigate();
  const setTitle = useTitleStore((s) => s.setTitle);

  useEffect(() => {
    setTitle('New post');
  }, [setTitle]);

  return (
    <Container size="sm" pt="md">
      <Box maw={600} mx="auto">
        <CreatePost
          onSuccess={(post) => navigate(`/posts/${post.id}`)}
          onCancel={() => navigate(-1)}
        />
      </Box>
    </Container>
  );
}
