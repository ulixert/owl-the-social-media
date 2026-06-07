import { useQueryClient } from '@tanstack/react-query';

// Threads-style "reload": scroll back to the top and re-fetch the feed, so
// clicking the active feed (in the sidebar or the header title) visibly
// refreshes instead of doing nothing. Shared by the nav and the header.
export function useReloadFeed() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: ['posts'] });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
}
