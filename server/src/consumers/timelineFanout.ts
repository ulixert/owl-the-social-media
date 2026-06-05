// CDC consumer: maintains the per-user "Following" feeds (feed:{userId} ZSETs)
// by fanning out Post change events from owl.public.Post.
//
//   pnpm --filter server consume:feed
//
// Fan-out-on-write for the long tail; celebrities (>= CELEBRITY_FOLLOWER_THRESHOLD
// followers) are skipped here and merged in at read time instead, to avoid write
// amplification. Offsets are committed, so a restart resumes; `feed:reconcile`
// rebuilds feeds from Postgres if they drift.

import { Kafka, logLevel } from 'kafkajs';

import { prisma } from '../db/index.js';
import {
  CELEBRITY_FOLLOWER_THRESHOLD,
  FEED_MAX,
  feedKey,
  postEventEffect,
} from '../features/post/feed.js';
import { redis } from '../redis.js';

const TOPIC = 'owl.public.Post';
const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:19092').split(',');

const kafka = new Kafka({
  clientId: 'owl-timeline-fanout',
  brokers,
  logLevel: logLevel.WARN,
});
const consumer = kafka.consumer({ groupId: 'owl-timeline-fanout' });

// The audience for a post: the author's followers plus the author (so they see
// their own posts), matching the pull model's `followedIds.push(currentUserId)`.
async function audienceOf(authorId: number): Promise<number[]> {
  const followers = await prisma.userFollows.findMany({
    where: { followingId: authorId },
    select: { followerId: true },
  });
  return [...followers.map((f) => f.followerId), authorId];
}

async function applyAdd(postId: number, authorId: number): Promise<void> {
  // Skip celebrities — too many followers to fan out; read-time merge covers them.
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { followersCount: true },
  });
  if (!author || author.followersCount >= CELEBRITY_FOLLOWER_THRESHOLD) return;

  const audience = await audienceOf(authorId);
  const pipeline = redis.pipeline();
  for (const userId of audience) {
    pipeline.zadd(feedKey(userId), postId, String(postId));
    pipeline.zremrangebyrank(feedKey(userId), 0, -(FEED_MAX + 1)); // cap newest N
  }
  await pipeline.exec();
}

async function applyRemove(postId: number, authorId: number): Promise<void> {
  const audience = await audienceOf(authorId);
  const pipeline = redis.pipeline();
  for (const userId of audience) {
    pipeline.zrem(feedKey(userId), String(postId));
  }
  await pipeline.exec();
}

async function main(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });
  console.log(`[timeline-fanout] consuming ${TOPIC} from ${brokers.join(',')}`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return; // tombstone
      let parsed: unknown;
      try {
        parsed = JSON.parse(message.value.toString());
      } catch {
        return;
      }
      const effect = postEventEffect(parsed);
      if (!effect) return;
      if (effect.op === 'add') await applyAdd(effect.postId, effect.authorId);
      else await applyRemove(effect.postId, effect.authorId);
    },
  });
}

async function shutdown(): Promise<void> {
  console.log('\n[timeline-fanout] shutting down...');
  await consumer.disconnect().catch(() => undefined);
  redis.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err: unknown) => {
  console.error('[timeline-fanout] fatal:', err);
  process.exit(1);
});
