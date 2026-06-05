import { Request, Response } from 'express';

import { prisma } from '../../db';
import { postQuerySchema } from '../../types/validation/schemas.js';
import { getFollowingFeedIds } from './feed.js';
import { withLikeCounts } from './likeCounts.js';

// Shared include shape for feed posts: author summary, parent author (for reply
// context), and the viewer's own like row (to derive isLiked).
export function feedInclude(viewerId: number | undefined) {
  return {
    postedBy: { select: { id: true, username: true, name: true, profilePic: true } },
    parentPost: { select: { postedBy: { select: { username: true } } } },
    likes: viewerId ? { where: { userId: viewerId } } : undefined,
  };
}

export function withIsLiked<T extends { likes?: unknown[] }>(post: T) {
  const { likes, ...rest } = post;
  return { ...rest, isLiked: likes ? likes.length > 0 : false };
}

// The original pull model: fan-in query over followed authors. Used directly
// when the Redis feed is cold/down, and to hydrate the merged id page below.
async function getFollowingPostsFromDb(
  viewerId: number,
  cursor: number,
  limit: number,
) {
  const followedUsers = await prisma.userFollows.findMany({
    where: { followerId: viewerId },
    select: { followingId: true },
  });
  const followedIds = followedUsers.map((f) => f.followingId);
  followedIds.push(viewerId); // include the viewer's own posts

  const posts = await prisma.post.findMany({
    where: {
      postedById: { in: followedIds },
      isDeleted: false,
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { id: 'desc' },
    take: limit,
    include: feedInclude(viewerId),
  });

  const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;
  return {
    posts: await withLikeCounts(posts.map(withIsLiked)),
    nextCursor,
  };
}

export async function getFollowingPosts(req: Request, res: Response) {
  try {
    const input = postQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid query params' });
      return;
    }

    const currentUserId = req.user!.id;
    const { cursor, limit } = input.data;

    // Hybrid read: the precomputed Redis feed merged with followed celebrities.
    // Returns null when we should serve straight from Postgres (Redis cold/down,
    // or paged past what the feed holds).
    const ids = await getFollowingFeedIds(currentUserId, cursor, limit);
    if (ids === null) {
      res.status(200).json(await getFollowingPostsFromDb(currentUserId, cursor, limit));
      return;
    }

    // Hydrate the id page. The isDeleted filter + id-membership drop any stale
    // ids left in the feed, so missed deletes are harmless.
    const rows = await prisma.post.findMany({
      where: { id: { in: ids }, isDeleted: false },
      include: feedInclude(currentUserId),
    });
    rows.sort((a, b) => b.id - a.id);

    // Cursor continues from the last *candidate* id (even if some were filtered),
    // so pagination doesn't skip posts.
    const nextCursor = ids.length === limit ? ids[ids.length - 1] : null;

    res.status(200).json({
      posts: await withLikeCounts(rows.map(withIsLiked)),
      nextCursor,
    });
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in getFollowingPosts: ', error);
  }
}

export async function getRecommendedPosts(req: Request, res: Response) {
  try {
    const input = postQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid query params' });
      return;
    }
    const { cursor, limit } = input.data;
    const currentUserId = req.user?.id;

    let followedIds: number[] = [];
    let likedByFollowedPostIds: number[] = [];

    if (currentUserId) {
      const followedUsers = await prisma.userFollows.findMany({
        where: { followerId: currentUserId },
        select: { followingId: true },
      });
      followedIds = followedUsers.map((f) => f.followingId);

      if (followedIds.length > 0) {
        const likesByFollowed = await prisma.like.findMany({
          where: { userId: { in: followedIds } },
          select: { postId: true },
          take: 50,
          orderBy: { createdAt: 'desc' },
        });
        likedByFollowedPostIds = likesByFollowed.map((l) => l.postId);
      }
    }

    const whereClause = currentUserId
      ? {
          isDeleted: false,
          OR: [
            { postedById: { in: followedIds } },
            { id: { in: likedByFollowedPostIds } },
            { likesCount: { gte: 3 } }, // Fallback to somewhat popular posts
          ],
        }
      : { isDeleted: false };

    // Fetch recommended posts
    const recommendedPosts = await prisma.post.findMany({
      where: { ...whereClause, ...(cursor ? { id: { lt: cursor } } : {}) },
      orderBy: { id: 'desc' },
      take: limit,
      include: {
        postedBy: {
          select: {
            id: true,
            username: true,
            name: true,
            profilePic: true,
          },
        },
        parentPost: {
          select: {
            postedBy: {
              select: {
                username: true,
              },
            },
          },
        },
        likes: req.user
          ? {
              where: {
                userId: req.user.id,
              },
            }
          : undefined,
      },
    });

    const postsWithIsLiked = recommendedPosts.map((post) => {
      const { likes, ...rest } = post;
      return {
        ...rest,
        isLiked: likes ? likes.length > 0 : false,
      };
    });

    // Determine the next cursor for pagination
    const nextCursor =
      recommendedPosts.length === limit
        ? recommendedPosts[recommendedPosts.length - 1].id
        : null;

    // Respond with recommended posts and pagination cursor
    res.status(200).json({
      posts: await withLikeCounts(postsWithIsLiked),
      nextCursor,
    });
  } catch (error) {
    console.error('Error in getRecommendedPosts:', error);
    res.status(500).json({ error: 'An unknown error occurred' });
  }
}

export async function getLikedPosts(req: Request, res: Response) {
  try {
    const input = postQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid query params' });
      return;
    }

    const currentUserId = req.user!.id;
    const { cursor, limit } = input.data;

    // Keyset-paginate the Like rows directly (most recently liked first) and
    // join the post in. Avoids loading every liked post id into memory.
    // nextCursor here is a Like.id — opaque to the client.
    const likeRows = await prisma.like.findMany({
      where: {
        userId: currentUserId,
        post: { isDeleted: false },
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit,
      select: {
        id: true,
        post: {
          include: {
            postedBy: {
              select: { id: true, username: true, name: true, profilePic: true },
            },
            parentPost: {
              select: { postedBy: { select: { username: true } } },
            },
            likes: req.user ? { where: { userId: req.user.id } } : undefined,
          },
        },
      },
    });

    const postsWithIsLiked = likeRows.map(({ post }) => {
      const { likes, ...rest } = post;
      return {
        ...rest,
        isLiked: likes ? likes.length > 0 : false,
      };
    });

    const nextCursor =
      likeRows.length === limit ? likeRows[likeRows.length - 1].id : null;

    res.status(200).json({
      posts: await withLikeCounts(postsWithIsLiked),
      nextCursor,
    });
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in getLikedPosts: ', error);
  }
}

export async function getSavedPosts(req: Request, res: Response) {
  try {
    const input = postQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid query params' });
      return;
    }

    const currentUserId = req.user!.id;
    const { cursor, limit } = input.data;

    // Keyset-paginate the Save rows directly (most recently saved first) and
    // join the post in. nextCursor here is a Save.id — opaque to the client.
    const saveRows = await prisma.save.findMany({
      where: {
        userId: currentUserId,
        post: { isDeleted: false },
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit,
      select: {
        id: true,
        post: {
          include: {
            postedBy: {
              select: { id: true, username: true, name: true, profilePic: true },
            },
            parentPost: {
              select: { postedBy: { select: { username: true } } },
            },
            likes: req.user ? { where: { userId: req.user.id } } : undefined,
          },
        },
      },
    });

    const postsWithIsLiked = saveRows.map(({ post }) => {
      const { likes, ...rest } = post;
      return {
        ...rest,
        isLiked: likes ? likes.length > 0 : false,
      };
    });

    const nextCursor =
      saveRows.length === limit ? saveRows[saveRows.length - 1].id : null;

    res.status(200).json({
      posts: await withLikeCounts(postsWithIsLiked),
      nextCursor,
    });
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in getSavedPosts: ', error);
  }
}
