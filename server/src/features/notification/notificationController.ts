import { Request, Response } from 'express';

import { prisma } from '../../db/index.js';
import {
  notificationParamsSchema,
  notificationQuerySchema,
} from '../../types/validation/schemas.js';
import {
  notificationInclude,
  serializeNotification,
} from './notificationService.js';

// Activity feed: the current user's notifications, newest first, keyset-
// paginated by id (matches the post feeds' cursor convention).
export async function getNotifications(req: Request, res: Response) {
  try {
    const input = notificationQuerySchema.safeParse(req.query);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid query params' });
      return;
    }

    const currentUserId = req.user!.id;
    const { cursor, limit } = input.data;

    const rows = await prisma.notification.findMany({
      where: {
        recipientId: currentUserId,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit,
      include: notificationInclude,
    });

    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
    res.status(200).json({
      notifications: rows.map(serializeNotification),
      nextCursor,
    });
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in getNotifications: ', error);
  }
}

// Powers the unread badge on the Activity nav item.
export async function getUnreadCount(req: Request, res: Response) {
  try {
    const count = await prisma.notification.count({
      where: { recipientId: req.user!.id, read: false },
    });
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in getUnreadCount: ', error);
  }
}

// Mark every unread notification for the current user as read (on viewing the
// Activity page).
export async function markAllRead(req: Request, res: Response) {
  try {
    await prisma.notification.updateMany({
      where: { recipientId: req.user!.id, read: false },
      data: { read: true },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in markAllRead: ', error);
  }
}

// Mark a single notification read. Scoped to the recipient so a user can't
// touch someone else's notifications.
export async function markRead(req: Request, res: Response) {
  try {
    const params = notificationParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: 'Invalid notification id' });
      return;
    }

    await prisma.notification.updateMany({
      where: { id: params.data.id, recipientId: req.user!.id },
      data: { read: true },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'An unknown error occurred' });
    console.error('Error in markRead: ', error);
  }
}
