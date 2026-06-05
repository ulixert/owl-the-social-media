// The search view: full-text indices for posts and users, derived from the CDC
// stream (owl.public.Post / owl.public.User) by the searchIndexer consumer and
// served by searchPosts / searchUsers.
//
//   owl-posts  → one doc per live post,  _id = postId,  searchable field: text
//   owl-users  → one doc per user,       _id = userId,  searchable: username, name
//
// Cache, not truth: Postgres stays authoritative. ES returns ranked *ids* only;
// the real post/user shape (isLiked, like counts, isFollowing) is hydrated from
// Postgres in relevance order, mirroring the trending/feed views. When ES is
// cold or down the read path falls back to a plain ILIKE query so search degrades
// rather than breaks. Soft-deleted posts are removed from the index, so live
// posts are exactly the indexed ones and queries need no isDeleted filter.

import { prisma } from '../../db/index.js';
import { es } from '../../elasticsearch.js';
import { withLikeCounts } from '../post/likeCounts.js';
import { feedInclude, withIsLiked } from '../post/postSerializers.js';

export const POSTS_INDEX = 'owl-posts';
export const USERS_INDEX = 'owl-users';

// Minimal mappings — we only index what we search on (plus the author id, handy
// for future filtering). Everything else is hydrated from Postgres at read time.
const POSTS_MAPPING = {
  properties: {
    text: { type: 'text' },
    postedById: { type: 'integer' },
  },
} as const;

const USERS_MAPPING = {
  properties: {
    // `name` is fuzzy-matched as free text; `username` gets a keyword sub-field
    // so an exact handle still ranks, but the text form drives partial matches.
    username: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    name: { type: 'text' },
  },
} as const;

// --- Documents -------------------------------------------------------------

export type PostDoc = { text: string; postedById: number };
export type UserDoc = { username: string; name: string | null };

export const toPostDoc = (row: { text: string; postedById: number }): PostDoc => ({
  text: row.text,
  postedById: row.postedById,
});

export const toUserDoc = (row: { username: string; name: string | null }): UserDoc => ({
  username: row.username,
  name: row.name ?? null,
});

// --- Pure CDC event → index effect -----------------------------------------

export type IndexEffect =
  | { op: 'index'; id: number; doc: PostDoc | UserDoc }
  | { op: 'delete'; id: number };

type DebeziumValue = {
  op?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

const numId = (row: Record<string, unknown> | null | undefined): number | null =>
  typeof row?.id === 'number' ? row.id : null;

/**
 * Pure mapping from a Debezium `Post` change event (JSON, schemas off) to its
 * effect on the owl-posts index:
 *   - create / snapshot-read / edit of a live post  => index
 *   - update that flips isDeleted to true            => delete (soft delete)
 *   - hard delete                                    => delete (PK is in `before`)
 * Returns null for events that can't be acted on.
 */
export function postSearchEffect(value: unknown): IndexEffect | null {
  const event = value as DebeziumValue | null;
  switch (event?.op) {
    case 'c':
    case 'r':
    case 'u': {
      const id = numId(event.after);
      if (id === null) return null;
      if (event.after?.isDeleted) return { op: 'delete', id };
      if (typeof event.after?.text !== 'string') return null;
      return { op: 'index', id, doc: toPostDoc(event.after as PostDoc) };
    }
    case 'd': {
      const id = numId(event.before);
      return id === null ? null : { op: 'delete', id };
    }
    default:
      return null;
  }
}

/** Pure mapping from a Debezium `User` change event to its owl-users effect. */
export function userSearchEffect(value: unknown): IndexEffect | null {
  const event = value as DebeziumValue | null;
  switch (event?.op) {
    case 'c':
    case 'r':
    case 'u': {
      const id = numId(event.after);
      if (id === null || typeof event.after?.username !== 'string') return null;
      return {
        op: 'index',
        id,
        doc: toUserDoc(event.after as { username: string; name: string | null }),
      };
    }
    case 'd': {
      const id = numId(event.before);
      return id === null ? null : { op: 'delete', id };
    }
    default:
      return null;
  }
}

// --- Index lifecycle -------------------------------------------------------

/** Create an index with its mapping if it doesn't already exist. */
async function ensureIndex(index: string, mappings: unknown): Promise<void> {
  if (await es.indices.exists({ index })) return;
  await es.indices.create({ index, mappings: mappings as never });
}

/** Idempotent: make sure both indices exist with their mappings. */
export async function ensureSearchIndices(): Promise<void> {
  await ensureIndex(POSTS_INDEX, POSTS_MAPPING);
  await ensureIndex(USERS_INDEX, USERS_MAPPING);
}

// --- Low-level queries (ranked ids) ----------------------------------------

type Hits = { ids: number[]; total: number };

/**
 * Run a search and return the hit ids (relevance order) plus the total match
 * count for offset pagination. Returns null to signal the caller should fall
 * back to Postgres — ES is down, errored, or the index doesn't exist yet.
 */
async function search(
  index: string,
  query: object,
  from: number,
  size: number,
): Promise<Hits | null> {
  try {
    const res = await es.search({
      index,
      from,
      size,
      query,
      _source: false, // we only need ids; the body is hydrated from Postgres
      track_total_hits: true,
    });
    const total =
      typeof res.hits.total === 'number' ? res.hits.total : (res.hits.total?.value ?? 0);
    return { ids: res.hits.hits.map((h) => Number(h._id)), total };
  } catch (err) {
    console.error('[search] elasticsearch query failed, falling back to db:', (err as Error).message);
    return null;
  }
}

const postQuery = (q: string) => ({ match: { text: { query: q, fuzziness: 'AUTO' } } });

const userQuery = (q: string) => ({
  multi_match: {
    query: q,
    fields: ['username^2', 'username.keyword^3', 'name'],
    fuzziness: 'AUTO',
  },
});

// --- High-level feeds (hydrated, with DB fallback) -------------------------

const offsetCursor = (from: number, size: number, total: number): number | null =>
  from + size < total ? from + size : null;

/**
 * Search posts: ES relevance hits hydrated from Postgres (kept in rank order),
 * or a Postgres ILIKE fallback. The cursor is an offset (not a post id) so the
 * meaning is identical on both paths; the client treats it opaquely.
 */
export async function searchPostsFeed(
  q: string,
  offset: number,
  limit: number,
  viewerId: number | undefined,
) {
  const hits = await search(POSTS_INDEX, postQuery(q), offset, limit);
  if (hits === null) return searchPostsFromDb(q, offset, limit, viewerId);

  const rows = await prisma.post.findMany({
    where: { id: { in: hits.ids }, isDeleted: false },
    include: feedInclude(viewerId),
  });
  const byId = new Map(rows.map((p) => [p.id, p]));
  const ranked = hits.ids.map((id) => byId.get(id)).filter((p) => p !== undefined);

  return {
    posts: await withLikeCounts(ranked.map(withIsLiked)),
    nextCursor: offsetCursor(offset, limit, hits.total),
  };
}

/** Degraded fallback: case-insensitive substring scan, newest first. */
async function searchPostsFromDb(
  q: string,
  offset: number,
  limit: number,
  viewerId: number | undefined,
) {
  const posts = await prisma.post.findMany({
    where: { text: { contains: q, mode: 'insensitive' }, isDeleted: false },
    orderBy: { id: 'desc' },
    skip: offset,
    take: limit,
    include: feedInclude(viewerId),
  });
  return {
    posts: await withLikeCounts(posts.map(withIsLiked)),
    nextCursor: posts.length === limit ? offset + limit : null,
  };
}

const userSelect = {
  id: true,
  username: true,
  name: true,
  profilePic: true,
  biography: true,
  followersCount: true,
} as const;

type UserRow = {
  id: number;
  username: string;
  name: string | null;
  profilePic: string | null;
  biography: string | null;
  followersCount: number;
};

/** Resolve "does the viewer follow each of these users" in one query (no N+1). */
async function withFollowStatus(users: UserRow[], viewerId: number | undefined) {
  let followedIds = new Set<number>();
  if (viewerId) {
    const follows = await prisma.userFollows.findMany({
      where: { followerId: viewerId, followingId: { in: users.map((u) => u.id) } },
      select: { followingId: true },
    });
    followedIds = new Set(follows.map((f) => f.followingId));
  }
  return users.map((u) => ({ ...u, isFollowing: followedIds.has(u.id) }));
}

/** Search users: ES relevance hits hydrated from Postgres, or an ILIKE fallback. */
export async function searchUsersFeed(
  q: string,
  offset: number,
  limit: number,
  viewerId: number | undefined,
) {
  const hits = await search(USERS_INDEX, userQuery(q), offset, limit);
  if (hits === null) return searchUsersFromDb(q, offset, limit, viewerId);

  const rows = await prisma.user.findMany({
    where: { id: { in: hits.ids } },
    select: userSelect,
  });
  const byId = new Map(rows.map((u) => [u.id, u]));
  const ranked = hits.ids.map((id) => byId.get(id)).filter((u) => u !== undefined);

  return {
    users: await withFollowStatus(ranked, viewerId),
    nextCursor: offsetCursor(offset, limit, hits.total),
  };
}

/** Degraded fallback: case-insensitive substring scan on username/name. */
async function searchUsersFromDb(
  q: string,
  offset: number,
  limit: number,
  viewerId: number | undefined,
) {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: { id: 'desc' },
    skip: offset,
    take: limit,
    select: userSelect,
  });
  return {
    users: await withFollowStatus(users, viewerId),
    nextCursor: users.length === limit ? offset + limit : null,
  };
}
