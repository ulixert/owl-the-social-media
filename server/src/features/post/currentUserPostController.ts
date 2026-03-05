import { Request, Response } from 'express';

import { prisma } from '../../db';
import { postQuerySchema } from '../../types/validation/schemas.js';

export async function getFollowingPosts(req: Request, res: Response) {
  try {
    const input = postQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid query params' });
      return;
    }

    const currentUserId = req.user!.id;

    const { cursor, limit } = input.data;

    // Get followed users (and include the current user)
    const followedUsers = await prisma.userFollows.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });

    const followedIds = followedUsers.map((follow) => follow.followingId);
    followedIds.push(currentUserId);

    // Fetch posts with pagination
    const posts = await prisma.post.findMany({
      where: {
        postedById: { in: followedIds },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      include: {
        postedBy: {
          select: {
            id: true,
            username: true,
            profilePic: true,
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

    const postsWithIsLiked = posts.map((post) => {
      const { likes, ...rest } = post;
      return {
        ...rest,
        isLiked: likes ? likes.length > 0 : false,
      };
    });

    const nextCursor = posts.length > 0 ? posts[posts.length - 1].id : null;

    res.status(200).json({ posts: postsWithIsLiked, nextCursor });
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in getHotPosts: ', error);
  }
}

export async function getRecommendedPosts(req: Request, res: Response) {
  try {
    const { cursor, limit = 10 } = req.query;
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
      where: whereClause,
      orderBy: [
        { createdAt: 'desc' },
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
      ],
      take: Number(limit),
      cursor: cursor ? { id: Number(cursor) } : undefined,
      skip: cursor ? 1 : 0,
      include: {
        postedBy: {
          select: {
            id: true,
            username: true,
            profilePic: true,
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
      recommendedPosts.length > 0
        ? recommendedPosts[recommendedPosts.length - 1].id
        : null;

    // Respond with recommended posts and pagination cursor
    res.status(200).json({ posts: postsWithIsLiked, nextCursor });
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

    const likedPosts = await prisma.like.findMany({
      where: { userId: currentUserId },
      select: { postId: true },
    });

    const postIds = likedPosts.map((like) => like.postId);

    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      orderBy: [
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      include: {
        postedBy: {
          select: {
            id: true,
            username: true,
            profilePic: true,
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

    const postsWithIsLiked = posts.map((post) => {
      const { likes, ...rest } = post;
      return {
        ...rest,
        isLiked: likes ? likes.length > 0 : false,
      };
    });

    const nextCursor = posts.length > 0 ? posts[posts.length - 1].id : null;

    res.status(200).json({ posts: postsWithIsLiked, nextCursor });
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

    const savedPosts = await prisma.save.findMany({
      where: { userId: currentUserId },
      select: { postId: true },
    });

    const postIds = savedPosts.map((save) => save.postId);

    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      orderBy: [
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      include: {
        postedBy: {
          select: {
            id: true,
            username: true,
            profilePic: true,
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

    const postsWithIsLiked = posts.map((post) => {
      const { likes, ...rest } = post;
      return {
        ...rest,
        isLiked: likes ? likes.length > 0 : false,
      };
    });

    const nextCursor = posts.length > 0 ? posts[posts.length - 1].id : null;

    res.status(200).json({ posts: postsWithIsLiked, nextCursor });
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in getSavedPosts: ', error);
  }
}
