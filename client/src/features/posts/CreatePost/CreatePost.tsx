import { useCallback, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PostCreateSchema, PostUpdateSchema } from 'validation';

import { axiosInstance } from '@/api/axiosConfig.ts';
import { UserAvatar } from '@/components/UserAvatar/UserAvatar.tsx';
import { UserHoverCard } from '@/features/user/UserHoverCard/UserHoverCard.tsx';
import { Post } from '@/hooks/usePosts.tsx';
import { useUploadImages } from '@/hooks/useUploadImages.ts';
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
  Grid,
  Group,
  Image,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { useAuthStore } from '@stores/authStore.ts';
import { IconPhoto } from '@tabler/icons-react';
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
  editingPost?: Post;
  onSuccess?: (post: CreatedPost) => void;
  onCancel?: () => void;
  isModal?: boolean;
};

export function CreatePost({
  parentPost,
  editingPost,
  onSuccess,
  onCancel,
  isModal,
}: CreatePostProps) {
  const userData = useAuthStore((s) => s.userData);
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const [text, setText] = useState(editingPost?.text ?? '');
  const [images, setImages] = useState<string[]>(editingPost?.images ?? []);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadImages = useUploadImages();

  const remaining = MAX_CHARS - text.length;
  const isOverLimit = remaining < 0;
  const isEmpty = text.trim().length === 0 && images.length === 0;

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      const room = MAX_IMAGES - images.length;
      if (room <= 0) {
        setError(`You can attach up to ${MAX_IMAGES} images`);
        return;
      }

      setError(null);
      try {
        const urls = await uploadImages.mutateAsync(files.slice(0, room));
        setImages((prev) => [...prev, ...urls]);
      } catch {
        setError('Upload failed. Please try again.');
      }
    },
    [images.length, uploadImages],
  );

  const removeImage = (url: string) => {
    setImages((prev) => prev.filter((img) => img !== url));
  };

  const createPostMutation = useMutation<CreatedPost, unknown, CreatePostInput>(
    {
      mutationFn: async (input: CreatePostInput) => {
        const body: CreatePostInput = {};
        if (input.text) body.text = input.text;
        if (input.images && input.images.length > 0) body.images = input.images;

        if (editingPost) {
          const res = await axiosInstance.put<CreatePostResponse>(
            `/posts/${editingPost.id}`,
            body,
          );
          return res.data.post;
        }

        const url = parentPost ? `/posts/${parentPost.id}` : '/posts';
        const res = await axiosInstance.post<CreatePostResponse>(url, body);
        return res.data.post;
      },
      onSuccess: (post) => {
        showSuccessNotification({
          title: editingPost
            ? 'Post updated'
            : parentPost
              ? 'Reply posted'
              : 'Posted',
          message: editingPost
            ? 'Your post has been updated.'
            : parentPost
              ? 'Your reply is live.'
              : 'Your post is live.',
        });
        void queryClient.invalidateQueries({ queryKey: ['posts'] });
        if (parentPost || editingPost?.parentPostId) {
          const pid = parentPost?.id ?? editingPost?.parentPostId;
          void queryClient.invalidateQueries({
            queryKey: ['childPosts', location.pathname, pid],
          });
          // Also invalidate the parent post to update its comment count
          void queryClient.invalidateQueries({
            queryKey: ['post', pid],
          });
        }
        if (editingPost) {
          void queryClient.invalidateQueries({
            queryKey: ['post', editingPost.id],
          });
        }
        setText('');
        setImages([]);
        onSuccess?.(post);
        if (isModal) {
          modals.closeAll();
        }
        if (!editingPost) {
          void navigate(`/posts/${post.id}`);
        }
      },
      onError: () => {
        showErrorNotification({
          title: editingPost ? 'Could not update' : 'Could not post',
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

    const schema = editingPost ? PostUpdateSchema : PostCreateSchema;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    createPostMutation.mutate(payload);
  };

  const postDisabled = isEmpty || isOverLimit || createPostMutation.isPending;

  const buttonLabel = editingPost ? 'Save' : parentPost ? 'Reply' : 'Post';

  return (
    <Box>
      {isModal && (
        <>
          <Flex align="center" justify="space-between" mb="sm">
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Text fw={700}>
              {editingPost ? 'Edit post' : parentPost ? 'Reply' : 'New post'}
            </Text>
            {/* spacer the width of the Cancel button so the title stays centered */}
            <Box w={64} />
          </Flex>
          <Divider mb="md" mx={-16} />
        </>
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
              <UserHoverCard username={parentPost.postedBy.username}>
                <Link
                  to={`/user/${parentPost.postedBy.username}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <Text size="sm" fw={700}>
                    {parentPost.postedBy.name}
                  </Text>
                </Link>
              </UserHoverCard>
              <Text size="sm" c="dimmed">
                @{parentPost.postedBy.username}
              </Text>
              <Text size="xs" c="dimmed">
                &bull;
              </Text>
              <Text size="xs" c="dimmed">
                {getPostTime(new Date(parentPost.createdAt))}
              </Text>
            </Group>
            <Text size="sm" lineClamp={3}>
              {parentPost.text}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Replying to{' '}
              <UserHoverCard username={parentPost.postedBy.username}>
                <Link
                  to={`/user/${parentPost.postedBy.username}`}
                  style={{ textDecoration: 'none' }}
                >
                  <Text span c="blue.6">
                    @{parentPost.postedBy.username}
                  </Text>
                </Link>
              </UserHoverCard>
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
            <Group gap={4} mb={4}>
              <Text size="sm" fw={700}>
                {userData?.name ?? 'You'}
              </Text>
              <Text size="sm" c="dimmed">
                @{userData?.username ?? 'you'}
              </Text>
            </Group>
          )}

          <Textarea
            placeholder={parentPost ? 'Post your reply' : "What's new?"}
            variant="unstyled"
            autosize
            minRows={isModal ? 3 : 1}
            maxRows={16}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!postDisabled) {
                  handlePost();
                }
              }
            }}
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
            <Box mt="xs">
              {images.length === 1 && (
                <Box pos="relative" className={classes.imageWrap}>
                  <Image
                    src={images[0]}
                    alt="attachment"
                    radius="lg"
                    h={260}
                    fit="cover"
                    fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
                  />
                  <CloseButton
                    size="sm"
                    variant="filled"
                    color="dark"
                    pos="absolute"
                    top={6}
                    left={6}
                    onClick={() => removeImage(images[0])}
                    aria-label="Remove image"
                    className={classes.imageClose}
                  />
                </Box>
              )}

              {images.length === 2 && (
                <SimpleGrid cols={2} spacing="xs">
                  {images.map((url) => (
                    <Box key={url} pos="relative" className={classes.imageWrap}>
                      <Image
                        src={url}
                        alt="attachment"
                        radius="lg"
                        h={200}
                        fit="cover"
                        fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
                      />
                      <CloseButton
                        size="sm"
                        variant="filled"
                        color="dark"
                        pos="absolute"
                        top={6}
                        left={6}
                        onClick={() => removeImage(url)}
                        aria-label="Remove image"
                        className={classes.imageClose}
                      />
                    </Box>
                  ))}
                </SimpleGrid>
              )}

              {images.length === 3 && (
                <Grid gap="xs">
                  <Grid.Col span={6}>
                    <Box pos="relative" className={classes.imageWrap}>
                      <Image
                        src={images[0]}
                        alt="attachment"
                        radius="lg"
                        h={245}
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
                        onClick={() => removeImage(images[0])}
                        aria-label="Remove image"
                        className={classes.imageClose}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Stack gap="xs">
                      <Box pos="relative" className={classes.imageWrap}>
                        <Image
                          src={images[1]}
                          alt="attachment"
                          radius="lg"
                          h={118}
                          fit="cover"
                          fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
                        />
                        <CloseButton
                          size="sm"
                          variant="filled"
                          color="dark"
                          pos="absolute"
                          top={6}
                          left={6}
                          onClick={() => removeImage(images[1])}
                          aria-label="Remove image"
                          className={classes.imageClose}
                        />
                      </Box>
                      <Box pos="relative" className={classes.imageWrap}>
                        <Image
                          src={images[2]}
                          alt="attachment"
                          radius="lg"
                          h={118}
                          fit="cover"
                          fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
                        />
                        <CloseButton
                          size="sm"
                          variant="filled"
                          color="dark"
                          pos="absolute"
                          top={6}
                          left={6}
                          onClick={() => removeImage(images[2])}
                          aria-label="Remove image"
                          className={classes.imageClose}
                        />
                      </Box>
                    </Stack>
                  </Grid.Col>
                </Grid>
              )}

              {images.length >= 4 && (
                <SimpleGrid cols={2} spacing="xs">
                  {images.slice(0, 4).map((url) => (
                    <Box key={url} pos="relative" className={classes.imageWrap}>
                      <Image
                        src={url}
                        alt="attachment"
                        radius="lg"
                        h={120}
                        fit="cover"
                        fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
                      />
                      <CloseButton
                        size="sm"
                        variant="filled"
                        color="dark"
                        pos="absolute"
                        top={6}
                        left={6}
                        onClick={() => removeImage(url)}
                        aria-label="Remove image"
                        className={classes.imageClose}
                      />
                    </Box>
                  ))}
                </SimpleGrid>
              )}
            </Box>
          )}

          <Group gap="xs" mt="sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void handleFiles(e.currentTarget.files);
                e.currentTarget.value = '';
              }}
            />
            <ActionIcon
              variant="subtle"
              color="blue"
              size="md"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Add image"
              loading={uploadImages.isPending}
              disabled={images.length >= MAX_IMAGES}
            >
              <IconPhoto size={18} />
            </ActionIcon>

            {images.length > 0 && (
              <Text size="xs" c="dimmed">
                {images.length}/{MAX_IMAGES} image
                {images.length !== 1 ? 's' : ''}
              </Text>
            )}

            <Group gap="sm" ml="auto">
              <Text size="xs" c={isOverLimit ? 'red' : 'dimmed'}>
                {text.length}/{MAX_CHARS}
              </Text>
              <Button
                radius="xl"
                size="compact-sm"
                color="mono"
                onClick={handlePost}
                disabled={postDisabled}
                loading={createPostMutation.isPending}
              >
                {buttonLabel}
              </Button>
            </Group>
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
