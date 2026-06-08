import { Tooltip, UnstyledButton } from '@mantine/core';

import { formatCount } from '@/utils/formatCount.ts';
import classes from './PostActions.module.css';

type PostActionProps = {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  count?: number;
};

// One action = a Threads-style pill: icon (+ optional count) with a single
// neutral gray hover background — no per-action colour. Active states (liked,
// reposted) colour the icon itself, set by the caller.
export function PostAction({ children, label, onClick, count }: PostActionProps) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  }

  return (
    <Tooltip
      label={label}
      position="bottom"
      openDelay={500}
      closeDelay={100}
      transitionProps={{ transition: 'fade', duration: 300 }}
      px={4}
      pt={0}
      pb={2}
    >
      <UnstyledButton
        className={classes.action}
        onClick={handleClick}
        aria-label={label}
      >
        {children}
        {count ? <span className={classes.count}>{formatCount(count)}</span> : null}
      </UnstyledButton>
    </Tooltip>
  );
}
