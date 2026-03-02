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
      },
    });

    const nextCursor = posts.length > 0 ? posts[posts.length - 1].id : null;

    res.status(200).json({ posts, nextCursor });
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in getHotPosts: ', error);
  }
}

export async function getRecommendedPosts(req: Request, res: Response) {
  try {
    const { cursor, limit = 10 } = req.query;

    // Fetch recommended posts
    const recommendedPosts = await prisma.post.findMany({
      where: {
        isDeleted: false, // Exclude deleted posts
      },
      orderBy: [
        { commentsCount: 'desc' },
        { likesCount: 'desc' },
        { repostsCount: 'desc' },
        { createdAt: 'desc' },
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
      },
    });

    // Determine the next cursor for pagination
    const nextCursor =
      recommendedPosts.length > 0
        ? recommendedPosts[recommendedPosts.length - 1].id
        : null;

    // Respond with recommended posts and pagination cursor
    res.status(200).json({ posts: recommendedPosts, nextCursor });
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
      },
    });

    const nextCursor = posts.length > 0 ? posts[posts.length - 1].id : null;

    res.status(200).json({ posts, nextCursor });
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
      },
    });

    const nextCursor = posts.length > 0 ? posts[posts.length - 1].id : null;

    res.status(200).json({ posts, nextCursor });
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in getSavedPosts: ', error);
  }
}
