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
          // closeAll (not close(modalId)) — there's only ever one compose modal,
          // and close-by-id wasn't reliably matching, so Cancel did nothing.
          onCancel={() => modals.closeAll()}
          onSuccess={() => modals.closeAll()}
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
