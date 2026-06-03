import { Request, Response } from 'express';

import { prisma } from '../../db/index.js';
import { postParamsSchema } from '../../types/validation/schemas.js';

export async function likeUnlikePost(req: Request, res: Response) {
  try {
    const currentUserId = req.user!.id;
    const params = postParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'Invalid post data' });
      return;
    }

    const postId = params.data.postId;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { likes: true },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const isLiked = await prisma.like.findUnique({
      where: {
        userId_postId: {
          postId,
          userId: currentUserId,
        },
      },
    });

    if (isLiked) {
      await prisma.$transaction([
        prisma.like.delete({
          where: {
            userId_postId: {
              postId,
              userId: currentUserId,
            },
          },
        }),
        prisma.post.update({
          where: { id: postId },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.like.create({
          data: {
            userId: currentUserId,
            postId,
          },
        }),
        prisma.post.update({
          where: { id: postId },
          data: { likesCount: { increment: 1 } },
        }),
      ]);
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in likeUnlikePost: ', error);
  }
}

export async function saveOrUnsavePost(req: Request, res: Response) {
  try {
    const params = postParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'Invalid post data' });
      return;
    }

    const postId = params.data.postId;
    const currentUserId = req.user!.id; // Current user ID

    // Validate post existence
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      res.status(404).json({
        message: 'Post not found.',
      });
      return;
    }

    // Check if the post is already saved by the user
    const isSaved = await prisma.save.findUnique({
      where: {
        userId_postId: {
          postId,
          userId: currentUserId,
        },
      },
    });

    if (isSaved) {
      // Unsave the post
      await prisma.save.delete({
        where: {
          userId_postId: {
            postId,
            userId: currentUserId,
          },
        },
      });

      res.status(204).send();
    } else {
      // Save the post
      await prisma.save.create({
        data: {
          postId,
          userId: currentUserId,
        },
      });

      res.status(204).send();
    }
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred.' });
    console.error('Error in saveOrUnsavePost: ', error);
  }
}

export async function repostUnrepost(req: Request, res: Response) {
  try {
    const params = postParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'Invalid post data' });
      return;
    }

    const postId = params.data.postId;
    const currentUserId = req.user!.id;

    // Validate post existence
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      res.status(404).json({
        message: 'Post not found.',
      });
      return;
    }

    // Check if the post is already reposted by the user
    const isReposted = await prisma.repost.findUnique({
      where: {
        userId_postId: {
          postId,
          userId: currentUserId,
        },
      },
    });

    if (isReposted) {
      // Unrepost the post
      await prisma.$transaction([
        prisma.repost.delete({
          where: {
            userId_postId: {
              postId,
              userId: currentUserId,
            },
          },
        }),
        prisma.post.update({
          where: { id: post.id },
          data: { repostsCount: { decrement: 1 } },
        }),
      ]);

      res.status(204).send();
      return;
    }

    // Repost the post
    await prisma.$transaction([
      prisma.repost.create({
        data: {
          postId,
          userId: currentUserId,
        },
      }),
      prisma.post.update({
        where: { id: post.id },
        data: { repostsCount: { increment: 1 } },
      }),
    ]);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred.' });
    console.error('Error in repostPost: ', error);
  }
}
