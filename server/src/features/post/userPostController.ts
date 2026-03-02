import { Request, Response } from 'express';

import { prisma } from '../../db/index.js';
import { postQuerySchema } from '../../types/validation/schemas.js';

export async function getUserPosts(
  req: Request<{ username: string }>,
  res: Response,
) {
  try {
    const input = postQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid query params' });
      return;
    }

    const { username } = req.params;
    const { cursor, limit } = input.data;

    const posts = await prisma.post.findMany({
      where: { postedBy: { username }, parentPostId: null },
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
    console.error('Error in getUserPosts: ', error);
  }
}

export async function getUserReplies(
  req: Request<{ username: string }>,
  res: Response,
) {
  try {
    const input = postQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid query params' });
      return;
    }

    const { username } = req.params;
    const { cursor, limit } = input.data;

    const posts = await prisma.post.findMany({
      where: { postedBy: { username }, parentPostId: { not: null } },
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
        parentPost: {
          select: {
            id: true,
            text: true,
            images: true,
            postedBy: {
              select: {
                id: true,
                username: true,
                profilePic: true,
              },
            },
          },
        },
      },
    });

    const nextCursor = posts.length > 0 ? posts[posts.length - 1].id : null;

    res.status(200).json({ posts, nextCursor });
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in getUserReplies: ', error);
  }
}
