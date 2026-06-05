// Curated demo seed — a small, tasteful dataset for the *production* site so it
// doesn't look empty to visitors. This is the opposite of seed.ts: instead of a
// million gibberish rows for benchmarking, it's ~8 real-looking people and a few
// dozen handwritten posts (some with images, a couple of reply threads, spread
// over the last week or so).
//
// Run with:  DEMO_SEED_CONFIRM=1 pnpm --filter server seed:demo
//
// Safe to run against prod and safe to re-run: it NEVER truncates. It only owns
// the demo accounts listed below (by username) — on each run it upserts those
// users and replaces *their* posts/follows/likes, leaving all real data alone.

import argon2 from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '../../generated/prisma/client.js';
import { storage } from '../../src/storage/index.js';

const MS_PER_HOUR = 60 * 60 * 1000;
const NOW = Date.now();

// A shared password so any demo account can be logged into for a walkthrough.
// Override with DEMO_PASSWORD; defaults to something obvious and harmless.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'owldemo123';

const ASSET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets');

// Push a committed SVG asset through the real storage backend (disk now, S3
// later) and return the public URL — the same path a user upload takes, so the
// demo exercises the upload pipeline rather than hot-linking external images.
const urlCache = new Map<string, string>();
async function uploadAsset(file: string): Promise<string> {
  const cached = urlCache.get(file);
  if (cached) return cached;
  const buffer = await readFile(path.join(ASSET_DIR, `${file}.svg`));
  const { url } = await storage.save(buffer, 'image/svg+xml');
  urlCache.set(file, url);
  return url;
}

type DemoUser = {
  username: string;
  name: string;
  biography: string;
  avatar: string; // asset filename (without extension)
}

const USERS: DemoUser[] = [
  {
    username: 'owl',
    name: 'OWL',
    biography: 'The night-owl social network. Built in the open 🦉',
    avatar: 'avatar-owl',
  },
  {
    username: 'ada',
    name: 'Ada Quinn',
    biography: 'Backend & distributed systems. I think about consistency more than is healthy.',
    avatar: 'avatar-ada',
  },
  {
    username: 'devon',
    name: 'Devon Marsh',
    biography: 'Frontend engineer. React, TypeScript, and well-placed whitespace.',
    avatar: 'avatar-devon',
  },
  {
    username: 'priya',
    name: 'Priya Nair',
    biography: 'Data + ML. Turning logs into stories. Occasional astrophotographer.',
    avatar: 'avatar-priya',
  },
  {
    username: 'leo',
    name: 'Leo Alvarez',
    biography: 'SRE. On call so you can sleep. Coffee → uptime.',
    avatar: 'avatar-leo',
  },
  {
    username: 'maya',
    name: 'Maya Chen',
    biography: 'Product designer. Sweating the details since 2014.',
    avatar: 'avatar-maya',
  },
  {
    username: 'sam',
    name: 'Sam Whitfield',
    biography: 'Indie hacker shipping small things. #buildinpublic',
    avatar: 'avatar-sam',
  },
  {
    username: 'nina',
    name: 'Nina Kovač',
    biography: 'Security engineer. Breaking things so they break less later.',
    avatar: 'avatar-nina',
  },
];

type DemoPost = {
  by: string; // author username
  text: string;
  imageAssets?: string[]; // asset filenames (without extension), uploaded at seed time
  hoursAgo: number;
  replyTo?: number; // index into ROOTS (root posts only get replies here)
  likedBy?: string[]; // usernames
}

// Root (non-reply) posts, newest first is NOT required — we sort by time so that
// id order ends up chronological, matching how the real feeds paginate.
const ROOTS: DemoPost[] = [
  {
    by: 'owl',
    text: 'Welcome to OWL 🦉 A tiny Twitter-style app built to learn real system design — CDC, streaming, derived state, the works. Poke around the feed!',
    hoursAgo: 2,
    likedBy: ['ada', 'devon', 'priya', 'leo', 'maya', 'sam', 'nina'],
  },
  {
    by: 'ada',
    text: 'Moved our like counts off a Postgres column and onto a Redis counter fed by a CDC stream. The dual-write is gone and the read path got simpler. Eventually consistent, and that’s fine here.',
    hoursAgo: 5,
    likedBy: ['owl', 'leo', 'nina', 'priya'],
  },
  {
    by: 'priya',
    text: 'Clear skies last night. Stacked ~200 frames of the Orion nebula from the backyard. Still amazed this is possible with consumer gear.',
    imageAssets: ['post-nebula'],
    hoursAgo: 9,
    likedBy: ['owl', 'maya', 'devon', 'sam'],
  },
  {
    by: 'devon',
    text: 'Reminder that a default parameter referencing a `const` declared later in the same scope is a TDZ trap. Spent an afternoon on a `/posts undefined` URL because of exactly this. Resolve it in the body.',
    hoursAgo: 14,
    likedBy: ['ada', 'sam', 'nina'],
  },
  {
    by: 'maya',
    text: 'Spent the morning on empty states. The screen a new user sees first is the most important screen in the product, and it’s usually the last one we design.',
    imageAssets: ['post-wireframe'],
    hoursAgo: 20,
    likedBy: ['owl', 'devon', 'priya', 'sam'],
  },
  {
    by: 'leo',
    text: 'EC2 box ran out of disk overnight. Culprit: months of dangling Docker image layers from every deploy. Added a `docker image prune -f` to the pipeline. Boring fix, good night’s sleep.',
    hoursAgo: 28,
    likedBy: ['ada', 'nina', 'sam'],
  },
  {
    by: 'sam',
    text: 'Shipped a tiny thing today and three people used it. That’s the whole job, honestly. #buildinpublic',
    hoursAgo: 34,
    likedBy: ['owl', 'maya', 'devon', 'priya', 'leo'],
  },
  {
    by: 'nina',
    text: 'Friendly reminder: stateless JWTs can’t be revoked. If you need real logout, you need a session store. Refresh-token rotation with reuse detection is the move.',
    hoursAgo: 41,
    likedBy: ['ada', 'leo', 'owl'],
  },
  {
    by: 'ada',
    text: 'Keyset pagination beats OFFSET every single time at scale. Order by id, carry a cursor, never count rows you’re going to throw away.',
    hoursAgo: 50,
    likedBy: ['devon', 'priya', 'leo', 'nina'],
  },
  {
    by: 'priya',
    text: 'A good dashboard answers one question. A bad dashboard has 40 panels and answers none.',
    hoursAgo: 62,
    likedBy: ['owl', 'maya', 'leo'],
  },
  {
    by: 'devon',
    text: 'Bumped the whole stack to React 19 + Mantine 9 + Express 5. The diff was scary, the runtime was fine. Tests caught the two things that weren’t.',
    hoursAgo: 73,
    likedBy: ['ada', 'sam', 'maya'],
  },
  {
    by: 'maya',
    text: 'Whitespace is not empty. It’s the part of the design doing the quiet work.',
    hoursAgo: 88,
    likedBy: ['devon', 'priya', 'sam', 'owl'],
  },
  {
    by: 'sam',
    text: 'Coffee count today: 4. Bugs fixed: 4. Correlation is not causation but I’m not changing anything.',
    imageAssets: ['post-coffee'],
    hoursAgo: 96,
    likedBy: ['leo', 'devon', 'nina'],
  },
];

// Replies. `replyTo` is the index of the ROOTS entry being replied to.
const REPLIES: DemoPost[] = [
  {
    by: 'leo',
    replyTo: 1,
    text: 'The reconcile script that rebuilds the counter from count(*) is the real hero. Drift happens; being able to heal it in one pass is what makes me trust the cache.',
    hoursAgo: 4,
    likedBy: ['ada', 'owl'],
  },
  {
    by: 'nina',
    replyTo: 1,
    text: 'Single-writer counter + graceful fallback to the DB column on a Redis miss is a really clean failure story. Nice.',
    hoursAgo: 3,
    likedBy: ['ada'],
  },
  {
    by: 'sam',
    replyTo: 2,
    text: 'This is gorgeous. What scope?',
    hoursAgo: 8,
    likedBy: ['priya'],
  },
  {
    by: 'priya',
    replyTo: 2,
    text: 'Just a 6" reflector and a lot of patience (and free software for the stacking).',
    hoursAgo: 7,
    likedBy: ['sam', 'owl', 'maya'],
  },
  {
    by: 'ada',
    replyTo: 3,
    text: 'esbuild hoisting the const into the TDZ and silently handing you `undefined` is the part that really gets people. Great writeup.',
    hoursAgo: 13,
    likedBy: ['devon'],
  },
  {
    by: 'owl',
    replyTo: 6,
    text: 'This is exactly the spirit. Three real users > a thousand vanity signups.',
    hoursAgo: 33,
    likedBy: ['sam', 'maya'],
  },
];

// Follow graph (follower -> following). Everyone follows OWL; the rest is a
// loosely connected little community.
const FOLLOWS: [string, string][] = [
  ['ada', 'owl'], ['devon', 'owl'], ['priya', 'owl'], ['leo', 'owl'],
  ['maya', 'owl'], ['sam', 'owl'], ['nina', 'owl'],
  ['owl', 'ada'], ['owl', 'priya'], ['owl', 'maya'],
  ['devon', 'ada'], ['leo', 'ada'], ['nina', 'ada'], ['sam', 'ada'],
  ['ada', 'leo'], ['priya', 'leo'], ['sam', 'devon'], ['maya', 'devon'],
  ['devon', 'maya'], ['priya', 'maya'], ['sam', 'priya'], ['leo', 'nina'],
  ['ada', 'nina'], ['maya', 'sam'], ['owl', 'devon'], ['priya', 'devon'],
];

async function main(): Promise<void> {
  if (process.env.DEMO_SEED_CONFIRM !== '1') {
    throw new Error(
      'Refusing to run without DEMO_SEED_CONFIRM=1 (writes demo data to DATABASE_URL).',
    );
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  const started = Date.now();

  try {
    const hashed = await argon2.hash(DEMO_PASSWORD);

    // ---- Upsert the demo users (stable usernames are the natural key) ----
    console.log(`Upserting ${USERS.length} demo users...`);
    for (const u of USERS) {
      const profilePic = await uploadAsset(u.avatar);
      await prisma.user.upsert({
        where: { username: u.username },
        create: {
          username: u.username,
          email: `${u.username}@demo.owl`,
          name: u.name,
          password: hashed,
          biography: u.biography,
          profilePic,
        },
        update: {
          name: u.name,
          password: hashed,
          biography: u.biography,
          profilePic,
        },
      });
    }

    const demoUsers = await prisma.user.findMany({
      where: { username: { in: USERS.map((u) => u.username) } },
      select: { id: true, username: true },
    });
    const idOf = new Map(demoUsers.map((u) => [u.username, u.id]));
    const demoIds = [...idOf.values()];

    // ---- Wipe only the demo accounts' own content, then rebuild it ----
    // (replies are deleted before roots so the parentPostId FK is satisfied).
    console.log('Clearing previous demo content...');
    await prisma.like.deleteMany({
      where: { OR: [{ userId: { in: demoIds } }, { post: { postedById: { in: demoIds } } }] },
    });
    await prisma.save.deleteMany({ where: { userId: { in: demoIds } } });
    await prisma.repost.deleteMany({ where: { userId: { in: demoIds } } });
    await prisma.post.deleteMany({
      where: { postedById: { in: demoIds }, parentPostId: { not: null } },
    });
    await prisma.post.deleteMany({ where: { postedById: { in: demoIds } } });
    await prisma.userFollows.deleteMany({
      where: { OR: [{ followerId: { in: demoIds } }, { followingId: { in: demoIds } }] },
    });

    // ---- Follows ----
    console.log(`Creating ${FOLLOWS.length} follow edges...`);
    await prisma.userFollows.createMany({
      data: FOLLOWS.map(([follower, following]) => ({
        followerId: idOf.get(follower)!,
        followingId: idOf.get(following)!,
      })),
      skipDuplicates: true,
    });

    // ---- Root posts (sorted oldest-first so id order is chronological) ----
    console.log(`Creating ${ROOTS.length} posts...`);
    const rootsByTime = ROOTS.map((p, i) => ({ p, i })).sort(
      (a, b) => b.p.hoursAgo - a.p.hoursAgo,
    );
    const rootDbId = new Map<number, number>(); // ROOTS index -> db id
    for (const { p, i } of rootsByTime) {
      const created = new Date(NOW - p.hoursAgo * MS_PER_HOUR);
      const post = await prisma.post.create({
        data: {
          postedById: idOf.get(p.by)!,
          text: p.text,
          images: await Promise.all((p.imageAssets ?? []).map(uploadAsset)),
          createdAt: created,
        },
        select: { id: true },
      });
      rootDbId.set(i, post.id);
    }

    // ---- Replies (after roots so parents exist) ----
    const replyDbIds: number[] = [];
    const replyMeta: DemoPost[] = [];
    for (const r of [...REPLIES].sort((a, b) => b.hoursAgo - a.hoursAgo)) {
      const created = new Date(NOW - r.hoursAgo * MS_PER_HOUR);
      const post = await prisma.post.create({
        data: {
          postedById: idOf.get(r.by)!,
          parentPostId: rootDbId.get(r.replyTo!)!,
          text: r.text,
          images: await Promise.all((r.imageAssets ?? []).map(uploadAsset)),
          createdAt: created,
        },
        select: { id: true },
      });
      replyDbIds.push(post.id);
      replyMeta.push(r);
    }

    // ---- Likes ----
    const likeRows: { userId: number; postId: number }[] = [];
    for (const { p, i } of ROOTS.map((p, i) => ({ p, i }))) {
      for (const liker of p.likedBy ?? []) {
        likeRows.push({ userId: idOf.get(liker)!, postId: rootDbId.get(i)! });
      }
    }
    replyMeta.forEach((r, idx) => {
      for (const liker of r.likedBy ?? []) {
        likeRows.push({ userId: idOf.get(liker)!, postId: replyDbIds[idx] });
      }
    });
    console.log(`Creating ${likeRows.length} likes...`);
    await prisma.like.createMany({ data: likeRows, skipDuplicates: true });

    // ---- Recompute denormalized counters for the affected rows only ----
    console.log('Recomputing counters...');
    await prisma.$executeRaw`
      UPDATE "User" u SET "followersCount" = c.cnt
      FROM (SELECT "followingId" AS id, count(*) cnt FROM "UserFollows" GROUP BY 1) c
      WHERE u.id = c.id AND u.id = ANY(${demoIds})`;
    await prisma.$executeRaw`
      UPDATE "User" u SET "followingCount" = c.cnt
      FROM (SELECT "followerId" AS id, count(*) cnt FROM "UserFollows" GROUP BY 1) c
      WHERE u.id = c.id AND u.id = ANY(${demoIds})`;
    // likesCount: Redis is the source of truth in this app, but prod has no Redis
    // and falls back to this column, so keep it correct.
    await prisma.$executeRaw`
      UPDATE "Post" p SET "likesCount" = c.cnt
      FROM (SELECT "postId" AS id, count(*) cnt FROM "Like" GROUP BY 1) c
      WHERE p.id = c.id AND p."postedById" = ANY(${demoIds})`;
    await prisma.$executeRaw`
      UPDATE "Post" p SET "commentsCount" = c.cnt
      FROM (SELECT "parentPostId" AS id, count(*) cnt FROM "Post"
            WHERE "parentPostId" IS NOT NULL GROUP BY 1) c
      WHERE p.id = c.id AND p."postedById" = ANY(${demoIds})`;

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `\nDone in ${secs}s. ${USERS.length} users, ${ROOTS.length + REPLIES.length} posts, ${likeRows.length} likes.`,
    );
    console.log(`Demo login: any handle above + password "${DEMO_PASSWORD}".`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('\nDemo seed failed:', err);
  process.exit(1);
});
