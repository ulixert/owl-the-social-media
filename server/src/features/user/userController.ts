import { Request, Response } from 'express';
import { UserUpdateSchema } from 'validation';

import { prisma } from '../../db';
import {
  createNotification,
  publishNotification,
} from '../notification/notificationService.js';

// "Who to follow": the most-followed accounts, excluding the viewer and anyone
// they already follow. Powers the Explore page's suggestions.
export async function getRecommendedUsers(req: Request, res: Response) {
  try {
    const currentUserId = req.user?.id;

    let excludeIds: number[] = [];
    if (currentUserId) {
      const follows = await prisma.userFollows.findMany({
        where: { followerId: currentUserId },
        select: { followingId: true },
      });
      excludeIds = [currentUserId, ...follows.map((f) => f.followingId)];
    }

    const users = await prisma.user.findMany({
      where: excludeIds.length ? { id: { notIn: excludeIds } } : {},
      orderBy: { followersCount: 'desc' },
      take: 8,
      select: {
        id: true,
        username: true,
        name: true,
        profilePic: true,
        biography: true,
        followersCount: true,
      },
    });

    // Excluded the followed set above, so none of these are followed.
    const usersWithFollowStatus = users.map((user) => ({
      ...user,
      isFollowing: false,
    }));

    res.status(200).json({ users: usersWithFollowStatus });
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred' });
    console.error('Error in getRecommendedUsers: ', error);
  }
}

export async function followAndUnfollowUser(
  req: Request<{ id: string }>,
  res: Response,
) {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;
    const targetUserId = Number.parseInt(id, 10);

    // Check if the user is trying to follow/unfollow themselves
    if (targetUserId === currentUserId) {
      res.status(400).json({
        message: 'You cannot follow or unfollow yourself.',
      });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      res.status(404).json({
        message: 'User not found.',
      });
      return;
    }

    // Check if the user is already following the target user
    const isFollowing = await prisma.userFollows.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
    });

    if (isFollowing) {
      // Unfollow: remove the edge and adjust both counters atomically.
      await prisma.$transaction([
        prisma.userFollows.delete({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: targetUserId,
            },
          },
        }),
        prisma.user.update({
          where: { id: targetUserId },
          data: { followersCount: { decrement: 1 } },
        }),
        prisma.user.update({
          where: { id: currentUserId },
          data: { followingCount: { decrement: 1 } },
        }),
      ]);

      res.status(204).send();
    } else {
      // Follow: create the edge, adjust both counters, and record the
      // notification atomically. Publish only after the commit.
      const notification = await prisma.$transaction(async (tx) => {
        await tx.userFollows.create({
          data: {
            followerId: currentUserId,
            followingId: targetUserId,
          },
        });
        await tx.user.update({
          where: { id: targetUserId },
          data: { followersCount: { increment: 1 } },
        });
        await tx.user.update({
          where: { id: currentUserId },
          data: { followingCount: { increment: 1 } },
        });
        return createNotification(tx, {
          recipientId: targetUserId,
          actorId: currentUserId,
          type: 'FOLLOW',
        });
      });
      await publishNotification(notification);

      res.status(204).send();
    }
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred.' });
    console.error('Error in followAndUnfollowUser: ', error);
  }
}

export async function updateUserProfile(req: Request, res: Response) {
  try {
    const input = UserUpdateSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid user data' });
      return;
    }

    const currentUserId = req.user!.id;

    await prisma.user.update({
      where: { id: currentUserId },
      data: input.data,
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred.' });
    console.error('Error in updateUser: ', error);
  }
}

export async function getUserProfile(
  req: Request<{ username: string }>,
  res: Response,
) {
  try {
    const { username } = req.params;
    const user = await prisma.user.findUnique({
      where: { username },
      omit: {
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

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

    res.status(200).json({ user: { ...user, isFollowing } });
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred.' });
    console.error('Error in getUserProfile: ', error);
  }
}

// Ids of every user the current user follows. The client caches this once and
// uses it to render the avatar follow badges, so it never has to re-derive
// follow state per post in the feed.
export async function getFollowingIds(req: Request, res: Response) {
  try {
    const rows = await prisma.userFollows.findMany({
      where: { followerId: req.user!.id },
      select: { followingId: true },
    });
    res.status(200).json({ ids: rows.map((r) => r.followingId) });
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred.' });
    console.error('Error in getFollowingIds: ', error);
  }
}

export async function getMyData(req: Request, res: Response) {
  try {
    const currentUserId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        username: true,
        name: true,
        profilePic: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred.' });
    console.error('Error in getMyData: ', error);
  }
}
