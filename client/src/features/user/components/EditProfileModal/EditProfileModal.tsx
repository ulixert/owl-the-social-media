import { useState } from 'react';
import { UserProfile } from '@/hooks/useUserProfile.ts';
import { useUpdateProfileMutation } from '../../hooks/useUpdateProfileMutation.ts';
import {
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

type EditProfileModalProps = {
  user: UserProfile;
  onClose: () => void;
};

export function EditProfileModal({ user, onClose }: EditProfileModalProps) {
  const [name, setName] = useState(user.name);
  const [biography, setBiography] = useState(user.biography || '');
  const [profilePic, setProfilePic] = useState(user.profilePic || '');

  const mutation = useUpdateProfileMutation(user.username);

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
        <Avatar src={profilePic} size="lg" radius="xl" />
      </Flex>

      <Divider />

      <Box>
        <Text size="sm" fw={700} mb={4}>Bio</Text>
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

      <Divider />

      <Box>
        <Text size="sm" fw={700} mb={4}>Profile Picture URL</Text>
        <TextInput
          placeholder="https://..."
          value={profilePic}
          onChange={(e) => setProfilePic(e.currentTarget.value)}
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
