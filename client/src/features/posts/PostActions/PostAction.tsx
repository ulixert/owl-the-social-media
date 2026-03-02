import { ActionIcon, Tooltip } from '@mantine/core';
import { useHover } from '@mantine/hooks';

type PostActionProps = {
  children: React.ReactNode;
  color: string;
  onClick: () => void;
  type: string;
};

export function PostAction({
  children,
  color,
  onClick,
  type,
}: PostActionProps) {
  const { hovered, ref } = useHover();

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  }

  return (
    <Tooltip
      label={type}
      position="bottom"
      openDelay={500}
      closeDelay={100}
      transitionProps={{ transition: 'fade', duration: 300 }}
      px={4}
      pt={0}
      pb={2}
    >
      <div ref={ref}>
        <ActionIcon
          onClick={handleClick}
          radius={100}
          p={4}
          w={32}
          h={32}
          variant="subtle"
          color={hovered ? color : 'gray.6'}
        >
          {children}
        </ActionIcon>
      </div>
    </Tooltip>
  );
}
