import { LoadingOverlay } from '@mantine/core';

export function Loading() {
  return (
    <LoadingOverlay
      visible={true}
      zIndex={1000}
      overlayProps={{ radius: 'sm', blur: 2 }}
      loaderProps={{ color: 'mono', type: 'bars' }}
    />
  );
}
