import { useRef, useState } from 'react';

import { UserProfile } from '@/hooks/useUserProfile.ts';
import { useUploadImages } from '@/hooks/useUploadImages.ts';
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconCamera } from '@tabler/icons-react';

import { useUpdateProfileMutation } from '../../hooks/useUpdateProfileMutation.ts';

type EditProfileModalProps = {
  user: UserProfile;
  onClose: () => void;
};

export function EditProfileModal({ user, onClose }: EditProfileModalProps) {
  const [name, setName] = useState(user.name);
  const [biography, setBiography] = useState(user.biography ?? '');
  const [profilePic, setProfilePic] = useState(user.profilePic ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useUpdateProfileMutation(user.username);
  const uploadImages = useUploadImages();

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return;
    const [url] = await uploadImages.mutateAsync([file]);
    if (url) setProfilePic(url);
  };

  const handleSave = async () => {
    await mutation.mutateAsync({
      name,
      biography: biography || null,
      profilePic: profilePic || null,
    });
    onClose();
  };

  return (
    <Stack gap="md">
      <Flex justify="space-between" align="center">
        <Box flex={1}>
          <TextInput
            label="Name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            fw={700}
            variant="unstyled"
            styles={{ input: { fontSize: '1.1rem', padding: 0 } }}
          />
        </Box>
        <Box pos="relative">
          <Avatar src={profilePic} size="lg" radius="xl" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void handleAvatarFile(e.currentTarget.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
          <ActionIcon
            variant="filled"
            color="dark"
            radius="xl"
            size="sm"
            pos="absolute"
            bottom={0}
            right={0}
            onClick={() => fileInputRef.current?.click()}
            loading={uploadImages.isPending}
            aria-label="Upload profile picture"
          >
            <IconCamera size={14} />
          </ActionIcon>
        </Box>
      </Flex>

      <Divider />

      <Box>
        <Text size="sm" fw={700} mb={4}>
          Bio
        </Text>
        <Textarea
          placeholder="+ Write bio"
          value={biography}
          onChange={(e) => setBiography(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={4}
          variant="unstyled"
          styles={{ input: { padding: 0 } }}
        />
      </Box>

      <Group justify="flex-end" mt="xl">
        <Button
          fullWidth
          radius="xl"
          size="md"
          color="yellow"
          onClick={handleSave}
          loading={mutation.isPending}
        >
          Done
        </Button>
      </Group>
    </Stack>
  );
}
