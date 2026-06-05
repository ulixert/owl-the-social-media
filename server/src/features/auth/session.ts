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

export type SessionToken = { familyId: string; jti: string };

export type RotateResult =
  | { status: 'rotated'; jti: string }
  | { status: 'reuse' }
  | { status: 'missing' };

/** Start a new session family with its first token. */
export async function createSession(): Promise<SessionToken> {
  const familyId = randomUUID();
  const jti = randomUUID();
  await redis.set(familyKey(familyId), jti, 'EX', TTL_SECONDS);
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

/** Revoke a session family (logout). */
export async function revokeSession(familyId: string): Promise<void> {
  await redis.del(familyKey(familyId));
}
