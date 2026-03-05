import { DropdownMenu } from '@/components/DropdownMenu/DropdownMenu.tsx';
import { ReturnButton } from '@/components/ReturnButton/ReturnButton.tsx';
import { ActionIcon, Flex, UnstyledButton } from '@mantine/core';
import { useAuthStore } from '@stores/authStore.ts';
import { useTitleStore } from '@stores/titleStore.ts';
import { IconArrowDown } from '@tabler/icons-react';

import { useCreatePostModal } from '@/features/posts/hooks/useCreatePostModal.tsx';
import classes from './Header.module.css';

export function HeaderDesktop() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const title = useTitleStore((state) => state.title);
  const { openCreatePostModal } = useCreatePostModal();

  return (
    <Flex justify="center" align="center" p="md" gap={10}>
      <ReturnButton />
      <UnstyledButton>{title}</UnstyledButton>

      {isAuthenticated && (
        <DropdownMenu
          target={
            <ActionIcon
              radius={100}
              className={classes.dropdownIcon}
              size={24}
              color="gray"
            >
              <IconArrowDown size={16} />
            </ActionIcon>
          }
          itemsBeforeDivider={[
            { name: 'For you', path: '/for-you' },
            { name: 'Following', path: '/following' },
            { name: 'Liked', path: '/liked' },
            { name: 'Saved', path: '/saved' },
          ]}
          itemsAfterDivider={[
            {
              name: 'Create new post',
              onClick: () => {
                openCreatePostModal();
              },
            },
          ]}
        />
      )}
    </Flex>
  );
}
