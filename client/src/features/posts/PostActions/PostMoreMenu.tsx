import { ActionIcon, Menu, rem, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconDots, IconEdit, IconTrash } from '@tabler/icons-react';
import { useDeletePostMutation } from '../hooks/useDeletePostMutation.ts';
import { Post } from '@/hooks/usePosts.tsx';
import { CreatePost } from '../CreatePost/CreatePost.tsx';

type PostMoreMenuProps = {
  post: Post;
  isOwner: boolean;
};

export function PostMoreMenu({ post, isOwner }: PostMoreMenuProps) {
  const deleteMutation = useDeletePostMutation(post.id);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    modals.openConfirmModal({
      title: 'Delete post?',
      centered: true,
      children: (
        <Text size="sm">
          This can’t be undone and it will be removed from your profile, the timeline of any accounts that follow you, and from search results.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red', radius: 'xl' },
      cancelProps: { radius: 'xl' },
      onConfirm: () => deleteMutation.mutate(),
    });
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    const modalId = 'edit-post-modal';
    modals.open({
      id: modalId,
      children: (
        <CreatePost
          editingPost={post}
          isModal
          onCancel={() => modals.close(modalId)}
          onSuccess={() => modals.close(modalId)}
        />
      ),
      size: 'lg',
      radius: 'lg',
      withCloseButton: false,
      centered: true,
      padding: 'md',
    });
  };

  if (!isOwner) return null;

  return (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={(e) => e.stopPropagation()}
        >
          <IconDots size={rem(18)} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
        <Menu.Item
          leftSection={<IconEdit style={{ width: rem(14), height: rem(14) }} />}
          onClick={handleEdit}
        >
          Edit
        </Menu.Item>
        <Menu.Item
          color="red"
          leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />}
          onClick={handleDelete}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
