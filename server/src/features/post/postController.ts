import { Request, Response } from 'express';
import { PostCreateSchema, PostUpdateSchema } from 'validation';
import { z } from 'zod';

import { prisma } from '../../db';
import {
  createPostPramsSchema,
  postParamsSchema,
  postQuerySchema,
} from '../../types/validation/schemas.js';

export async function getHotPosts(req: Request, res: Response) {
  try {
    const input = postQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid query params' });
      return;
    }
    const { cursor, limit } = input.data;

    const posts = await prisma.post.findMany({
      where: { isDeleted: false },
      orderBy: [
        { createdAt: 'desc' },
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
      ],
      take: limit,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
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

export async function getPostById(req: Request, res: Response) {
  try {
    const params = postParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'Invalid post data' });
      return;
    }

    const postId = params.data.postId;

    // Fetch the main post details including user info
    const post = await prisma.post.findUnique({
      where: { id: postId },
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

    if (!post) {
      res.status(404).json({ message: 'Post not found' });
      return;
    }

    const { likes, ...rest } = post;
    const postWithIsLiked = {
      ...rest,
      isLiked: likes ? (likes as any[]).length > 0 : false,
    };

    res.status(200).json({ post: postWithIsLiked });
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred' });
    console.error('Error in getPostById: ', error);
  }
}

export async function getChildPosts(req: Request, res: Response) {
  try {
    const params = postParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'Invalid post data' });
      return;
    }

    const postId = params.data.postId;

    const input = postQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid query params' });
      return;
    }

    const { cursor, limit } = input.data;

    const childPosts = await prisma.post.findMany({
      where: { parentPostId: postId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
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

    const postsWithIsLiked = childPosts.map((post) => {
      const { likes, ...rest } = post;
      return {
        ...rest,
        isLiked: likes ? likes.length > 0 : false,
      };
    });

    const nextCursor =
      childPosts.length > 0 ? childPosts[childPosts.length - 1].id : null;
    res.status(200).json({ childPosts: postsWithIsLiked, nextCursor });
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred' });
    console.error('Error in getChildPosts: ', error);
  }
}

export async function createPost(req: Request, res: Response) {
  try {
    const params = createPostPramsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'Invalid post data' });
      return;
    }

    const parentPostId = params.data.parentPostId;

    // Validate input
    const input = PostCreateSchema.safeParse(req.body);
    const currentUserId = req.user!.id;
    if (!input.success) {
      res.status(400).json({ error: 'Invalid post data' });
      return;
    }

    const { text, images } = input.data;

    // Check if the parent post exists
    if (parentPostId) {
      const parentPost = await prisma.post.findUnique({
        where: { id: parentPostId },
      });

      if (!parentPost) {
        res.status(404).json({ error: 'Parent post not found' });
        return;
      }

      // Increment the comments count of the parent post
      await prisma.post.update({
        where: { id: parentPostId },
        data: { commentsCount: { increment: 1 } },
      });
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        text,
        images: images ?? undefined,
        parentPostId: parentPostId,
        postedById: currentUserId,
      },
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
      },
    });

    res.status(201).json({ post });
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in createPost: ', error);
  }
}

export async function deletePost(req: Request, res: Response) {
  try {
    const params = postParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'Invalid post data' });
      return;
    }

    const postId = params.data.postId;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { postedById: true },
    });
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check if the user is authorized to delete the post
    const currentUserId = req.user!.id;
    if (post.postedById !== currentUserId) {
      res
        .status(403)
        .json({ error: 'You are not authorized to delete this post' });
      return;
    }

    await prisma.post.update({
      where: { id: postId },
      data: { isDeleted: true },
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in deletePost: ', error);
  }
}

export async function updatePost(req: Request, res: Response) {
  try {
    const params = postParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'Invalid post data' });
      return;
    }

    const postId = params.data.postId;

    // Validate input
    const input = PostUpdateSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: input.error.errors[0]?.message ?? 'Invalid input' });
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { postedById: true },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check if the user is authorized to update the post
    const currentUserId = req.user!.id;
    if (post.postedById !== currentUserId) {
      res
        .status(403)
        .json({ error: 'You are not authorized to update this post' });
      return;
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: input.data,
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
      },
    });

    res.status(200).json({ post: updatedPost });
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in updatePost: ', error);
  }
}

const searchQuerySchema = postQuerySchema.extend({
  q: z.string().min(1),
});

export async function searchUsers(req: Request, res: Response) {
  try {
    const input = searchQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid search query' });
      return;
    }

    const { q, cursor, limit } = input.data;

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      select: {
        id: true,
        username: true,
        name: true,
        profilePic: true,
        biography: true,
        followersCount: true,
      },
    });

    // Check if the current user is following these users
    const usersWithFollowStatus = await Promise.all(
      users.map(async (user) => {
        let isFollowing = false;
        if (req.user) {
          const follow = await prisma.userFollows.findUnique({
            where: {
              followerId_followingId: {
                followerId: req.user.id,
                followingId: user.id,
              },
            },
          });
          isFollowing = !!follow;
        }
        return { ...user, isFollowing };
      }),
    );

    const nextCursor = users.length > 0 ? users[users.length - 1].id : null;

    res.status(200).json({ users: usersWithFollowStatus, nextCursor });
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred' });
    console.error('Error in searchUsers: ', error);
  }
}

export async function searchPosts(req: Request, res: Response) {
  try {
    const input = searchQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid search query' });
      return;
    }

    const { q, cursor, limit } = input.data;

    const posts = await prisma.post.findMany({
      where: {
        text: { contains: q, mode: 'insensitive' },
        isDeleted: false,
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
    res.status(500).json({ message: 'An unknown error occurred' });
    console.error('Error in searchPosts: ', error);
  }
}
