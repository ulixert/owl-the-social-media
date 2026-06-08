import React from 'react';

import { Stack } from '@mantine/core';

import classes from './PostMain.module.css';

type PostMainProps = {
  children: React.ReactNode;
  gap?: number;
  // Extra bottom padding, used by chained thread posts so the avatar-column
  // connector has room to run down to the next post.
  pb?: number;
};

export function PostMain({ children, gap = 8, pb }: PostMainProps) {
  return (
    <Stack gap={gap} pb={pb} className={classes.main}>
      {children}
    </Stack>
  );
}
