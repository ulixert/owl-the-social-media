import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PostCreateSchema, PostType } from 'validation';

import { axiosInstance } from '@/api/axiosConfig';
import {
  showErrorNotification,
  showSuccessNotification,
} from '@/utils/showNotification';
import {
  ActionIcon,
  Avatar,
  Box,
  CloseButton,
  Divider,
  Group,
  Image,
  Popover,
  SimpleGrid,
  Text,
  TextInput,
  Textarea,
  UnstyledButton,
} from '@mantine/core';
import { useAuthStore } from '@stores/authStore';
import { useTitleStore } from '@stores/titleStore';
import { IconPhoto, IconX } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const MAX_CHARS = 500;

type CreatePostInput = {
  text?: string;
  images?: string[];
};

type CreatedPost = PostType & {
  postedBy: {
    id: number;
    username: string;
    profilePic: string | null;
  };
};

type CreatePostResponse = {
  post: CreatedPost;
};

export function CreatePostPage() {
  const navigate = useNavigate();
  const setTitle = useTitleStore((s) => s.setTitle);
  const userData = useAuthStore((s) => s.userData);
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [imagePopoverOpen, setImagePopoverOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle('New post');
  }, [setTitle]);

  const remaining = MAX_CHARS - text.length;
  const isOverLimit = remaining < 0;
  const isEmpty = text.trim().length === 0 && images.length === 0;

  const addImage = () => {
    const trimmed = imageUrl.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed); // basic URL validation
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    if (images.includes(trimmed)) {
      setError('Image already added');
      return;
    }

    setImages((prev) => [...prev, trimmed]);
    setImageUrl('');
    setImagePopoverOpen(false);
    setError(null);
  };

  const removeImage = (url: string) => {
    setImages((prev) => prev.filter((img) => img !== url));
  };

  const createPostMutation = useMutation<CreatedPost, unknown, CreatePostInput>(
    {
      mutationFn: async (input: CreatePostInput) => {
        const body: CreatePostInput = {};
        if (input.text) body.text = input.text;
        if (input.images && input.images.length > 0) body.images = input.images;

        const res = await axiosInstance.post<CreatePostResponse>(
          '/posts',
          body,
        );
        return res.data.post;
      },
      onSuccess: async (post) => {
        showSuccessNotification({
          title: 'Posted',
          message: 'Your post is live.',
        });
        await queryClient.invalidateQueries({ queryKey: ['posts'] });
        await navigate(`/posts/${post.id}`);
      },
      onError: () => {
        showErrorNotification({
          title: 'Could not post',
          message: 'Something went wrong. Please try again.',
        });
      },
    },
  );

  const handlePost = () => {
    setError(null);

    const payload: CreatePostInput = {};
    if (text.trim()) payload.text = text.trim();
    if (images.length > 0) payload.images = images;

    const parsed = PostCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }

    createPostMutation.mutate(payload);
  };

  return (
    <Box maw={600} mx="auto" pt="md">
      {/* Header bar */}
      <Group justify="space-between" mb="sm" px="sm">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          onClick={() => navigate(-1)}
          aria-label="Cancel"
        >
          <IconX size={20} />
        </ActionIcon>

        <UnstyledButton
          onClick={handlePost}
          disabled={isEmpty || isOverLimit || createPostMutation.isPending}
          style={{
            fontWeight: 600,
            fontSize: '0.9rem',
            padding: '6px 20px',
            borderRadius: 20,
            color:
              isEmpty || isOverLimit || createPostMutation.isPending
                ? 'var(--mantine-color-dimmed)'
                : '#fff',
            backgroundColor:
              isEmpty || isOverLimit || createPostMutation.isPending
                ? 'var(--mantine-color-default-border)'
                : 'var(--mantine-color-blue-filled)',
            cursor:
              isEmpty || isOverLimit || createPostMutation.isPending
                ? 'not-allowed'
                : 'pointer',
            transition: 'background-color 150ms ease',
          }}
        >
          {createPostMutation.isPending ? 'Posting…' : 'Post'}
        </UnstyledButton>
      </Group>

      <Divider />

      {/* Compose area */}
      <Group align="flex-start" gap="sm" px="sm" pt="md" wrap="nowrap">
        {/* Avatar column */}
        <Avatar
          src={userData?.profilePic}
          alt={userData?.username}
          radius="xl"
          size={42}
          mt={2}
        />

        {/* Text column */}
        <Box style={{ flex: 1 }}>
          <Text fw={600} size="sm" mb={4}>
            {userData?.username ?? 'You'}
          </Text>

          <Textarea
            placeholder="What's new?"
            variant="unstyled"
            autosize
            minRows={3}
            maxRows={16}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            styles={{
              input: {
                fontSize: '1rem',
                lineHeight: 1.5,
                padding: 0,
              },
            }}
            autoFocus
          />

          {/* Image previews */}
          {images.length > 0 && (
            <SimpleGrid cols={images.length === 1 ? 1 : 2} spacing="xs" mt="xs">
              {images.map((url) => (
                <Box
                  key={url}
                  pos="relative"
                  style={{ borderRadius: 12, overflow: 'hidden' }}
                >
                  <Image
                    src={url}
                    alt="attachment"
                    radius="md"
                    h={images.length === 1 ? 260 : 160}
                    fit="cover"
                    fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
                  />
                  <CloseButton
                    size="sm"
                    variant="filled"
                    color="dark"
                    pos="absolute"
                    top={6}
                    right={6}
                    onClick={() => removeImage(url)}
                    aria-label="Remove image"
                    style={{ opacity: 0.85 }}
                  />
                </Box>
              ))}
            </SimpleGrid>
          )}

          {/* Add image button with popover */}
          <Group gap="xs" mt="xs">
            <Popover
              opened={imagePopoverOpen}
              onChange={setImagePopoverOpen}
              width={300}
              position="bottom-start"
              shadow="md"
            >
              <Popover.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="md"
                  onClick={() => setImagePopoverOpen((o) => !o)}
                  aria-label="Add image"
                >
                  <IconPhoto size={18} />
                </ActionIcon>
              </Popover.Target>

              <Popover.Dropdown>
                <Text size="xs" fw={500} mb={6}>
                  Paste image URL
                </Text>
                <TextInput
                  placeholder="https://example.com/image.jpg"
                  size="sm"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addImage();
                    }
                  }}
                  autoFocus
                />
                <UnstyledButton
                  onClick={addImage}
                  mt={8}
                  style={{
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    padding: '4px 14px',
                    borderRadius: 16,
                    color: '#fff',
                    backgroundColor: 'var(--mantine-color-blue-filled)',
                  }}
                >
                  Add
                </UnstyledButton>
              </Popover.Dropdown>
            </Popover>

            {images.length > 0 && (
              <Text size="xs" c="dimmed">
                {images.length} image{images.length > 1 ? 's' : ''} attached
              </Text>
            )}
          </Group>
        </Box>
      </Group>

      {/* Footer: char count + error */}
      <Group justify="space-between" px="sm" mt="sm" mb="md">
        <Text size="xs" c="dimmed">
          Anyone can reply
        </Text>
        <Text
          size="xs"
          c={isOverLimit ? 'red' : remaining <= 50 ? 'yellow.6' : 'dimmed'}
          fw={isOverLimit ? 700 : 400}
        >
          {remaining}
        </Text>
      </Group>

      {error && (
        <Text c="red" size="sm" ta="center" px="sm" mb="md">
          {error}
        </Text>
      )}
    </Box>
  );
}