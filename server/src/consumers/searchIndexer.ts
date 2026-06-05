// CDC consumer: maintains the Elasticsearch search indices (owl-posts, owl-users)
// by applying Post and User change events from the CDC stream.
//
//   pnpm --filter server consume:search
//
// One consumer, two topics: it dispatches each message to the matching pure
// effect mapper, then indexes or deletes the doc. Offsets are committed so a
// restart resumes; `search:reconcile` rebuilds the indices from Postgres if they
// drift. The indices are a cache (see search.ts) — a write failure here degrades
// search, it doesn't lose data.

import { Kafka, logLevel } from 'kafkajs';

import { es } from '../elasticsearch.js';
import {
  ensureSearchIndices,
  IndexEffect,
  POSTS_INDEX,
  postSearchEffect,
  USERS_INDEX,
  userSearchEffect,
} from '../features/search/search.js';

const POST_TOPIC = 'owl.public.Post';
const USER_TOPIC = 'owl.public.User';
const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:19092').split(',');

const kafka = new Kafka({
  clientId: 'owl-search-indexer',
  brokers,
  logLevel: logLevel.WARN,
});
const consumer = kafka.consumer({ groupId: 'owl-search-indexer' });

async function apply(index: string, effect: IndexEffect): Promise<void> {
  if (effect.op === 'index') {
    await es.index({ index, id: String(effect.id), document: effect.doc });
  } else {
    // ignore 404s: deleting a doc that was never indexed is a no-op.
    await es.delete({ index, id: String(effect.id) }, { ignore: [404] });
  }
}

async function main(): Promise<void> {
  await ensureSearchIndices();
  await consumer.connect();
  await consumer.subscribe({ topics: [POST_TOPIC, USER_TOPIC], fromBeginning: true });
  console.log(`[search-indexer] consuming ${POST_TOPIC}, ${USER_TOPIC} from ${brokers.join(',')}`);

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return; // tombstone
      let parsed: unknown;
      try {
        parsed = JSON.parse(message.value.toString());
      } catch {
        return;
      }
      if (topic === POST_TOPIC) {
        const effect = postSearchEffect(parsed);
        if (effect) await apply(POSTS_INDEX, effect);
      } else {
        const effect = userSearchEffect(parsed);
        if (effect) await apply(USERS_INDEX, effect);
      }
    },
  });
}

async function shutdown(): Promise<void> {
  console.log('\n[search-indexer] shutting down...');
  await consumer.disconnect().catch(() => undefined);
  await es.close().catch(() => undefined);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err: unknown) => {
  console.error('[search-indexer] fatal:', err);
  process.exit(1);
});
