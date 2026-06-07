import { create } from 'zustand';

// Tracks users the viewer follows/unfollows *during this session* so avatar
// badges can show a "✓" right after a follow. It's intentionally not persisted:
// after a reload, a user you already follow shows no badge at all (the steady
// state), driven instead by the cached following-ids list.
type FollowBadgeState = {
  justFollowed: ReadonlySet<number>;
  markFollowed: (userId: number) => void;
  markUnfollowed: (userId: number) => void;
};

export const useFollowBadgeStore = create<FollowBadgeState>((set) => ({
  justFollowed: new Set<number>(),
  markFollowed: (userId) =>
    set((state) => {
      const next = new Set(state.justFollowed);
      next.add(userId);
      return { justFollowed: next };
    }),
  markUnfollowed: (userId) =>
    set((state) => {
      if (!state.justFollowed.has(userId)) return state;
      const next = new Set(state.justFollowed);
      next.delete(userId);
      return { justFollowed: next };
    }),
}));
