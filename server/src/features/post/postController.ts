import { Request, Response } from 'express';
import { PostCreateSchema, PostUpdateSchema } from 'validation';
import { z } from 'zod';

import { prisma } from '../../db';
import {
  createPostPramsSchema,
  postParamsSchema,
  postQuerySchema,
} from '../../types/validation/schemas.js';
import {
  createNotification,
  publishNotification,
} from '../notification/notificationService.js';
import { searchPostsFeed, searchUsersFeed } from '../search/search.js';
import { withLikeCounts } from './likeCounts.js';
import { getTrendingFeed } from './trending.js';

export async function getTrendingPosts(req: Request, res: Response) {
  try {
    const input = postQuerySchema.safeParse(req.query);
    const limit = input.success ? input.data.limit : 10;

    const posts = await getTrendingFeed(limit, req.user?.id);
    // Bounded top-K (the Flink window), so no pagination cursor.
    res.status(200).json({ posts, nextCursor: null });
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in getTrendingPosts: ', error);
  }
}

export async function getHotPosts(req: Request, res: Response) {
  try {
    const input = postQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid query params' });
      return;
    }
    const { cursor, limit } = input.data;

    const posts = await prisma.post.findMany({
      where: { isDeleted: false, ...(cursor ? { id: { lt: cursor } } : {}) },
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
        reposts: req.user
          ? {
              where: {
                userId: req.user.id,
              },
            }
          : undefined,
      },
    });

    const postsWithIsLiked = posts.map((post) => {
      const { likes, reposts, ...rest } = post;
      return {
        ...rest,
        isLiked: likes ? likes.length > 0 : false,
        isReposted: reposts ? reposts.length > 0 : false,
      };
    });

    const nextCursor =
      posts.length === limit ? posts[posts.length - 1].id : null;
    res.status(200).json({
      posts: await withLikeCounts(postsWithIsLiked),
      nextCursor,
    });
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
        reposts: req.user
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

    if (post.isDeleted) {
      res.status(200).json({
        post: {
          id: post.id,
          parentPostId: post.parentPostId,
          isDeleted: true,
          createdAt: post.createdAt,
          postedBy: {
            username: '',
            name: '',
            profilePic: null,
          },
          text: 'This post has been deleted.',
          images: [],
          likesCount: 0,
          commentsCount: 0,
          repostsCount: 0,
          isLiked: false,
          isReposted: false,
        },
      });
      return;
    }

    const { likes, reposts, ...rest } = post;
    const postWithIsLiked = {
      ...rest,
      isLiked: Array.isArray(likes) && likes.length > 0,
      isReposted: Array.isArray(reposts) && reposts.length > 0,
    };

    await withLikeCounts([postWithIsLiked]);
    res.status(200).json({ post: postWithIsLiked });
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred' });
    console.error('Error in getPostById: ', error);
  }
}

// The ancestor chain above a post, root-first, excluding the post itself — what
// the detail page renders above the focused post so you can scroll up through
// the whole thread.
export async function getPostAncestors(req: Request, res: Response) {
  try {
    const params = postParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'Invalid post data' });
      return;
    }

    const postId = params.data.postId;

    // Walk parentPostId up from the focused post in one query. depth 1 is the
    // immediate parent, higher is closer to the root; capped to bound
    // pathological chains.
    const rows = await prisma.$queryRaw<{ id: number; depth: number }[]>`
      WITH RECURSIVE ancestors AS (
        SELECT p."parentPostId" AS id, 1 AS depth
        FROM "Post" p
        WHERE p.id = ${postId} AND p."parentPostId" IS NOT NULL
        UNION ALL
        SELECT p."parentPostId" AS id, a.depth + 1
        FROM "Post" p
        JOIN ancestors a ON p.id = a.id
        WHERE p."parentPostId" IS NOT NULL AND a.depth < 50
      )
      SELECT id, depth FROM ancestors
    `;

    if (rows.length === 0) {
      res.status(200).json({ ancestors: [] });
      return;
    }

    // Root-first: matches how the chain reads top-to-bottom on screen.
    const orderedIds = rows.sort((a, b) => b.depth - a.depth).map((r) => r.id);

    const posts = await prisma.post.findMany({
      where: { id: { in: orderedIds } },
      include: {
        postedBy: {
          select: { id: true, username: true, name: true, profilePic: true },
        },
        parentPost: {
          select: { postedBy: { select: { username: true } } },
        },
        likes: req.user ? { where: { userId: req.user.id } } : undefined,
        reposts: req.user ? { where: { userId: req.user.id } } : undefined,
      },
    });

    const byId = new Map(posts.map((post) => [post.id, post]));

    const ancestors = orderedIds
      .map((id) => byId.get(id))
      .filter((post) => post !== undefined)
      .map((post) => {
        if (post.isDeleted) {
          // Same tombstone shape getPostById returns, so a deleted ancestor
          // still keeps the chain intact.
          return {
            id: post.id,
            parentPostId: post.parentPostId,
            isDeleted: true,
            createdAt: post.createdAt,
            postedBy: { username: '', name: '', profilePic: null },
            text: 'This post has been deleted.',
            images: [] as string[],
            likesCount: 0,
            commentsCount: 0,
            repostsCount: 0,
            isLiked: false,
            isReposted: false,
          };
        }
        const { likes, reposts, ...rest } = post;
        return {
          ...rest,
          isLiked: Array.isArray(likes) && likes.length > 0,
          isReposted: Array.isArray(reposts) && reposts.length > 0,
        };
      });

    await withLikeCounts(ancestors);
    res.status(200).json({ ancestors });
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred' });
    console.error('Error in getPostAncestors: ', error);
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
      where: {
        parentPostId: postId,
        isDeleted: false,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
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
        reposts: req.user
          ? {
              where: {
                userId: req.user.id,
              },
            }
          : undefined,
      },
    });

    const postsWithIsLiked = childPosts.map((post) => {
      const { likes, reposts, ...rest } = post;
      return {
        ...rest,
        isLiked: likes ? likes.length > 0 : false,
        isReposted: reposts ? reposts.length > 0 : false,
      };
    });

    const nextCursor =
      childPosts.length === limit
        ? childPosts[childPosts.length - 1].id
        : null;
    res.status(200).json({
      childPosts: await withLikeCounts(postsWithIsLiked),
      nextCursor,
    });
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

    const postArgs = {
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
    };

    // Verify the parent exists (for a clean 404) before creating a reply, and
    // capture its author so we can notify them.
    let parentAuthorId: number | undefined;
    if (parentPostId) {
      const parentPost = await prisma.post.findUnique({
        where: { id: parentPostId },
        select: { postedById: true },
      });
      if (!parentPost) {
        res.status(404).json({ error: 'Parent post not found' });
        return;
      }
      parentAuthorId = parentPost.postedById;
    }

    // For a reply, create the post, bump the parent's commentsCount, and record
    // the notification in one transaction so nothing can drift if a write fails.
    let notification: Awaited<ReturnType<typeof createNotification>> = null;
    const post = parentPostId
      ? await prisma.$transaction(async (tx) => {
          await tx.post.update({
            where: { id: parentPostId },
            data: { commentsCount: { increment: 1 } },
          });
          const reply = await tx.post.create(postArgs);
          notification = await createNotification(tx, {
            recipientId: parentAuthorId!,
            actorId: currentUserId,
            type: 'REPLY',
            postId: reply.id,
          });
          return reply;
        })
      : await prisma.post.create(postArgs);

    await publishNotification(notification);

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
      select: { postedById: true, parentPostId: true, isDeleted: true },
    });
    if (!post || post.isDeleted) {
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

    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        data: { isDeleted: true },
      });

      if (post.parentPostId) {
        await tx.post.update({
          where: { id: post.parentPostId },
          data: { commentsCount: { decrement: 1 } },
        });
      }
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
      res.status(400).json({ error: input.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { postedById: true, isDeleted: true },
    });

    if (!post || post.isDeleted) {
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

// Search is served from the Elasticsearch view (full-text, fuzzy, relevance
// ranked), hydrated from Postgres; it falls back to a plain ILIKE query when ES
// is cold or down. The cursor is an offset on both paths (see search.ts).
export async function searchUsers(req: Request, res: Response) {
  try {
    const input = searchQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid search query' });
      return;
    }

    const { q, cursor, limit } = input.data;
    const result = await searchUsersFeed(q, cursor, limit, req.user?.id);
    res.status(200).json(result);
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
    const result = await searchPostsFeed(q, cursor, limit, req.user?.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred' });
    console.error('Error in searchPosts: ', error);
  }
}
