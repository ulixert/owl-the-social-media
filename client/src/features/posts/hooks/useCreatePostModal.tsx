import { Post } from '@/hooks/usePosts';
import { modals } from '@mantine/modals';

import { CreatePost } from '../CreatePost/CreatePost';

export function useCreatePostModal() {
  const openCreatePostModal = (parentPost?: Post) => {
    const modalId = 'create-post-modal';
    modals.open({
      id: modalId,
      children: (
        <CreatePost
          parentPost={parentPost}
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

  return { openCreatePostModal };
}
