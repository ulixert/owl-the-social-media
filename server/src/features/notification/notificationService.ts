import { Prisma, NotificationType } from '../../../generated/prisma/client';
import { redis } from '../../redis.js';

// Redis pub/sub channel a notification is published to. The WS hub pattern-
// subscribes to `notifications:user:*` and fans each message out to the
// recipient's live sockets, so delivery works no matter which server instance
// holds the connection.
export const notificationChannel = (userId: number) =>
  `notifications:user:${userId}`;

// Shared shape for hydrating a notification with the actor + post it concerns.
// Used by both the live-publish path and the REST list so the wire format is
// identical either way.
export const notificationInclude = {
  actor: {
    select: { id: true, username: true, name: true, profilePic: true },
  },
  post: { select: { id: true, text: true } },
} satisfies Prisma.NotificationInclude;

export type HydratedNotification = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

type CreateNotificationInput = {
  recipientId: number;
  actorId: number;
  type: NotificationType;
  // The post involved (liked post, or the reply). Omit for FOLLOW.
  postId?: number;
};

// Write the notification row inside the caller's transaction so it commits
// atomically with the source action (like/follow/reply). Returns null when the
// actor is the recipient — we never notify someone about their own action — so
// callers can skip publishing.
export async function createNotification(
  tx: Prisma.TransactionClient,
  { recipientId, actorId, type, postId }: CreateNotificationInput,
): Promise<HydratedNotification | null> {
  if (recipientId === actorId) return null;

  return tx.notification.create({
    data: { recipientId, actorId, type, postId },
    include: notificationInclude,
  });
}

// Flatten a notification into the client-facing wire shape.
export function serializeNotification(n: HydratedNotification) {
  return {
    id: n.id,
    type: n.type,
    read: n.read,
    createdAt: n.createdAt,
    actor: n.actor,
    post: n.post,
  };
}

// Fan a committed notification out to the recipient's live sockets via Redis
// pub/sub. Call this AFTER the transaction commits so a rolled-back row can
// never be delivered. A no-op for null (self-notify, skipped above).
export async function publishNotification(
  n: HydratedNotification | null,
): Promise<void> {
  if (!n) return;
  await redis.publish(
    notificationChannel(n.recipientId),
    JSON.stringify(serializeNotification(n)),
  );
}
