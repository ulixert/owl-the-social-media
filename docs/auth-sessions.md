# Auth: stateful refresh tokens (rotation + reuse detection)

Access tokens stay **stateless** (15-min JWT, in client memory). The **refresh**
token is now **stateful**, backed by a Redis session store, which makes it
revocable, rotating, and reuse-detectable — things a plain JWT can't do.

```
login/signup ──> create session family (Redis: refresh:{familyId} = jti, TTL 7d)
                 set refresh cookie (httpOnly JWT carrying familyId + jti)

POST /auth/refresh-token (cookie) ──> verify JWT, then check Redis:
   familyId missing        → 401 (revoked / expired / logged out)
   jti ≠ stored jti        → REUSE: DEL family, 401  (a rotated-out token replayed)
   jti == stored jti       → rotate: new jti, reset TTL, set new cookie, new access token

POST /auth/logout (cookie) ──> DEL refresh:{familyId}, clear cookie

POST /auth/logout-all (access token) ──> DEL every family in user:{id}:families,
   DEL the set, clear cookie  ("log out everywhere")
```

## Why

A stateless refresh JWT can't be revoked — logout only clears the cookie, so a
**stolen** refresh token works until it expires (7 days). Making it stateful gives:

- **Revocation / real logout** — delete the family from Redis.
- **Rotation** — every refresh issues a new token and invalidates the old one, so a
  leaked token has a tiny useful lifetime.
- **Reuse detection** — if an *already-rotated* token is presented (only possible if
  it was captured), that's a theft signal → revoke the whole family, forcing re-login.
  This is the OAuth "refresh token rotation with reuse detection" BCP.

## Model

- Refresh JWT payload: `userId, username, name, profilePic, familyId, jti`.
- `familyId` = one login/session; `jti` = this specific token. Redis stores
  `refresh:{familyId}` → the single currently-valid `jti` (TTL 7d).
- The token is gated **both** by JWT signature **and** by the Redis check — signature
  alone proves authenticity, Redis proves it hasn't been rotated out or revoked.

Files: `server/src/features/auth/session.ts` (Redis helpers: `createSession`,
`rotateSession`, `revokeSession`, `revokeAllSessions`), `authController.ts`
(login/signup/refresh/logout/logoutAll), `authRouter.ts` (routes),
`utils/generateTokenAndSetCookie.ts` (`issueRefreshToken`).

## Log out everywhere

A login can spawn many sessions (phone, laptop, …), each its own family. To revoke
them all at once we keep a per-user index: a Redis **set** `user:{id}:families`
holding that user's family ids. `createSession` `SADD`s the new family (and resets
the set's 7-day TTL); `revokeAllSessions(userId)` reads the set, `DEL`s every
`refresh:{familyId}` in it, then drops the set. `POST /auth/logout-all` is
authenticated by the **access token** (it identifies the user without a cookie) and
also clears the current cookie, since "everywhere" includes this device.

The set is a **best-effort index, not truth**: a family can expire or be revoked
while its id lingers in the set, but revocation just `DEL`s by key (a no-op if it's
already gone), and the set's TTL self-bounds it to roughly the last 7 days of
sessions. So stale members are harmless and never cause a wrong revocation.

## Fail closed

Auth treats any Redis error as failure (→ 401/500); it never falls back to accepting
a token statelessly. A down Redis must not silently bypass revocation. The trade-off:
Redis is now a hard dependency for login/refresh/logout — hence it's in the prod
compose (`docker-compose.yml`), and `server/.prod.env` must set
`REDIS_URL=redis://redis:6379`.

## Concurrency

Rotation + two concurrent refreshes is a hazard: the first rotates the jti, the
second still holds the old one → false reuse detection → unwanted logout. The client
(`refreshAccessToken.ts`) uses **single-flight** — one shared in-flight refresh — so
concurrent 401s don't fire parallel refreshes. (A short server-side grace window for
the immediately-previous jti is an alternative; not implemented.)

## Verified

`server/src/test/authSession.test.ts`: refresh rotates (old token rejected); replaying
a rotated-out token → 401 **and** the family is revoked (the current token then also
fails); logout → subsequent refresh 401; missing token → 401; **log out everywhere**
across two sessions → `{ revokedSessions: 2 }` and both devices' refreshes 401;
`/auth/logout-all` without an access token → 401.

## Out of scope / next

- **Access-token denylist** — access tokens stay stateless, so a compromised one (or
  one held by a device after "log out everywhere") is valid until it expires (≤15 min);
  a Redis denylist checked in `protectRoute` would close that residual window.
- **Per-user session *list* UI** — the index now exists; surfacing active sessions
  ("Chrome on macOS · last active 2h ago") would need per-family device metadata.
