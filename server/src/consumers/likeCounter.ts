// CDC consumer: keeps the Redis per-post like count in sync with the source of
// truth by applying Debezium change events from owl.public.Like.
//
//   pnpm --filter server consume:likes
//
// Single writer of the like-count keys. Offsets are committed, so a normal
// restart resumes without reprocessing; `like:reconcile` repairs any drift.

import { Kafka, logLevel } from 'kafkajs';

import { likeCountKey, likeEventEffect } from '../features/post/likeCounts.js';
import { redis } from '../redis.js';

const TOPIC = 'owl.public.Like';
const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:19092').split(',');

const kafka = new Kafka({
  clientId: 'owl-like-counter',
  brokers,
  logLevel: logLevel.WARN,
});
const consumer = kafka.consumer({ groupId: 'owl-like-counter' });

async function main(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });
  console.log(`[like-counter] consuming ${TOPIC} from ${brokers.join(',')}`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return; // tombstone
      let parsed: unknown;
      try {
        parsed = JSON.parse(message.value.toString());
      } catch {
        return;
      }
      const effect = likeEventEffect(parsed);
      if (!effect) return;
      await redis.incrby(likeCountKey(effect.postId), effect.delta);
    },
  });
}

async function shutdown(): Promise<void> {
  console.log('\n[like-counter] shutting down...');
  await consumer.disconnect().catch(() => undefined);
  redis.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err: unknown) => {
  console.error('[like-counter] fatal:', err);
  process.exit(1);
});
