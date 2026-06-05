// Stateful refresh-token sessions in Redis. Each login starts a "family" (one
// session); the refresh token carries familyId + jti, and Redis holds the single
// jti currently valid for that family. This is what makes refresh tokens
// revocable (logout), rotating (new jti each refresh), and reuse-detectable
// (replaying a rotated-out jti revokes the whole family — a theft signal).
//
// Auth fails CLOSED: callers let Redis errors propagate (→ 401/500), never
// falling back to stateless acceptance, so a down Redis can't bypass revocation.

import { randomUUID } from 'node:crypto';

import { redis } from '../../redis.js';

const TTL_SECONDS = 7 * 24 * 60 * 60; // matches the 7-day refresh cookie

export const familyKey = (familyId: string) => `refresh:${familyId}`;
/** Set of a user's active session families, so they can all be revoked at once
 *  ("log out everywhere"). Stale members are harmless — a family key may expire
 *  or be revoked while its id lingers here, but revoking just DELs by key (a
 *  no-op if already gone). The set's TTL is refreshed on each new session, so it
 *  self-bounds to roughly the last 7 days of sessions. */
export const userFamiliesKey = (userId: number) => `user:${userId}:families`;

export type SessionToken = { familyId: string; jti: string };

export type RotateResult =
  | { status: 'rotated'; jti: string }
  | { status: 'reuse' }
  | { status: 'missing' };

/** Start a new session family for a user with its first token. */
export async function createSession(userId: number): Promise<SessionToken> {
  const familyId = randomUUID();
  const jti = randomUUID();
  await redis
    .multi()
    .set(familyKey(familyId), jti, 'EX', TTL_SECONDS)
    .sadd(userFamiliesKey(userId), familyId)
    .expire(userFamiliesKey(userId), TTL_SECONDS)
    .exec();
  return { familyId, jti };
}

/**
 * Rotate the family's token. Only the *current* jti may rotate:
 *  - no family record  → 'missing' (revoked / expired / logged out)
 *  - jti is stale       → 'reuse' (a rotated-out token replayed → revoke the family)
 *  - jti matches        → 'rotated' with a fresh jti (TTL reset)
 */
export async function rotateSession(
  familyId: string,
  presentedJti: string,
): Promise<RotateResult> {
  const current = await redis.get(familyKey(familyId));
  if (current === null) return { status: 'missing' };
  if (current !== presentedJti) {
    await redis.del(familyKey(familyId)); // theft signal — kill the whole family
    return { status: 'reuse' };
  }
  const jti = randomUUID();
  await redis.set(familyKey(familyId), jti, 'EX', TTL_SECONDS);
  return { status: 'rotated', jti };
}

/** Revoke a single session family (logout on this device). */
export async function revokeSession(
  userId: number,
  familyId: string,
): Promise<void> {
  await redis
    .multi()
    .del(familyKey(familyId))
    .srem(userFamiliesKey(userId), familyId)
    .exec();
}

/**
 * Revoke every session family for a user ("log out everywhere"). Deletes all
 * family keys in the user's set, then drops the set. Returns how many families
 * were revoked. Idempotent: an empty set revokes nothing and returns 0.
 */
export async function revokeAllSessions(userId: number): Promise<number> {
  const familyIds = await redis.smembers(userFamiliesKey(userId));
  const pipeline = redis.multi();
  for (const familyId of familyIds) pipeline.del(familyKey(familyId));
  pipeline.del(userFamiliesKey(userId));
  await pipeline.exec();
  return familyIds.length;
}
