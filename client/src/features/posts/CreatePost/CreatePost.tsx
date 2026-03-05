import { useCallback, useState } from 'react';
import { PostCreateSchema } from 'validation';

import { axiosInstance } from '@/api/axiosConfig.ts';
import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import { Post } from '@/hooks/usePosts.tsx';
import { getPostTime } from '@/utils/getPostTime.ts';
import {
  showErrorNotification,
  showSuccessNotification,
} from '@/utils/showNotification.tsx';
import {
  ActionIcon,
  Box,
  Button,
  CloseButton,
  Divider,
  Flex,
  Group,
  Image,
  Popover,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';
import { IconPhoto, IconX } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import classes from './CreatePost.module.css';

const MAX_CHARS = 500;
const MAX_IMAGES = 4;

type CreatePostInput = {
  text?: string;
  images?: string[];
};

type CreatedPost = Post;

type CreatePostResponse = {
  post: CreatedPost;
};

type CreatePostProps = {
  parentPost?: Post;
  onSuccess?: (post: CreatedPost) => void;
  onCancel?: () => void;
  isModal?: boolean;
};

export function CreatePost({
  parentPost,
  onSuccess,
  onCancel,
  isModal,
}: CreatePostProps) {
  const userData = useAuthStore((s) => s.userData);
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [imagePopoverOpen, setImagePopoverOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_CHARS - text.length;
  const isOverLimit = remaining < 0;
  const isEmpty = text.trim().length === 0 && images.length === 0;

  const addImage = useCallback(() => {
    const trimmed = imageUrl.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    if (images.length >= MAX_IMAGES) {
      setError(`You can attach up to ${MAX_IMAGES} images`);
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
  }, [imageUrl, images]);

  const removeImage = (url: string) => {
    setImages((prev) => prev.filter((img) => img !== url));
  };

  const createPostMutation = useMutation<CreatedPost, unknown, CreatePostInput>(
    {
      mutationFn: async (input: CreatePostInput) => {
        const body: CreatePostInput = {};
        if (input.text) body.text = input.text;
        if (input.images && input.images.length > 0) body.images = input.images;

        const url = parentPost ? `/posts/${parentPost.id}` : '/posts';
        const res = await axiosInstance.post<CreatePostResponse>(url, body);
        return res.data.post;
      },
      onSuccess: async (post) => {
        showSuccessNotification({
          title: parentPost ? 'Reply posted' : 'Posted',
          message: parentPost ? 'Your reply is live.' : 'Your post is live.',
        });
        await queryClient.invalidateQueries({ queryKey: ['posts'] });
        if (parentPost) {
          await queryClient.invalidateQueries({
            queryKey: ['childPosts', location.pathname, parentPost.id],
          });
        }
        setText('');
        setImages([]);
        onSuccess?.(post);
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

  const postDisabled = isEmpty || isOverLimit || createPostMutation.isPending;

  return (
    <Box>
      {isModal && (
        <Group justify="space-between" mb="sm">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            onClick={onCancel}
            aria-label="Cancel"
          >
            <IconX size={20} />
          </ActionIcon>

          <Button
            radius="xl"
            size="compact-sm"
            onClick={handlePost}
            disabled={postDisabled}
            loading={createPostMutation.isPending}
          >
            {parentPost ? 'Reply' : 'Post'}
          </Button>
        </Group>
      )}

      {isModal && parentPost && (
        <Flex gap={12} mb="xs">
          <Stack align="center" gap={0}>
            <UserAvatar
              username={parentPost.postedBy.username}
              avatar={parentPost.postedBy.profilePic}
            />
            <Box className={classes.line} />
          </Stack>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group gap={4}>
              <Text size="sm" fw={600}>
                {parentPost.postedBy.username}
              </Text>
              <Text size="xs" c="dimmed">
                {getPostTime(new Date(parentPost.createdAt))}
              </Text>
            </Group>
            <Text size="sm" lineClamp={3}>
              {parentPost.text}
            </Text>
            <Text size="xs" c="blue" mt={4}>
              Replying to @{parentPost.postedBy.username}
            </Text>
          </Box>
        </Flex>
      )}

      <Flex gap={12}>
        <Stack align="center">
          <UserAvatar
            username={userData?.username ?? 'You'}
            avatar={userData?.profilePic ?? null}
          />
        </Stack>

        <Box style={{ flex: 1, minWidth: 0 }}>
          {!isModal && (
            <Text size="sm" fw={600} mb={4}>
              {userData?.username ?? 'You'}
            </Text>
          )}

          <Textarea
            placeholder={parentPost ? 'Post your reply' : "What's new?"}
            variant="unstyled"
            autosize
            minRows={isModal ? 3 : 1}
            maxRows={16}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            styles={{
              input: {
                fontSize: 'var(--mantine-font-size-sm)',
                lineHeight: 1.5,
                padding: 0,
              },
            }}
            autoFocus={isModal}
          />

          {images.length > 0 && (
            <SimpleGrid cols={images.length === 1 ? 1 : 2} spacing="xs" mt="xs">
              {images.map((url) => (
                <Box key={url} pos="relative" className={classes.imageWrap}>
                  <Image
                    src={url}
                    alt="attachment"
                    radius="lg"
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
                    className={classes.imageClose}
                  />
                </Box>
              ))}
            </SimpleGrid>
          )}

          <Group gap="xs" mt="sm">
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
                  color="blue"
                  size="md"
                  onClick={() => setImagePopoverOpen((o) => !o)}
                  aria-label="Add image"
                  disabled={images.length >= MAX_IMAGES}
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
                <Button size="compact-xs" radius="xl" mt={8} onClick={addImage}>
                  Add
                </Button>
              </Popover.Dropdown>
            </Popover>

            {images.length > 0 && (
              <Text size="xs" c="dimmed">
                {images.length}/{MAX_IMAGES} image
                {images.length !== 1 ? 's' : ''}
              </Text>
            )}

            {!isModal && (
              <Button
                radius="xl"
                size="compact-sm"
                ml="auto"
                onClick={handlePost}
                disabled={postDisabled}
                loading={createPostMutation.isPending}
              >
                {parentPost ? 'Reply' : 'Post'}
              </Button>
            )}
          </Group>
        </Box>
      </Flex>

      {!isModal && <Divider mt="md" mx={-16} />}

      {error && (
        <Text c="red" size="sm" ta="center" px="sm" mt="sm">
          {error}
        </Text>
      )}
    </Box>
  );
}
