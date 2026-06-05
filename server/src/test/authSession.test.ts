import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { resetDb } from './helpers.js';

type CookieRes = { headers: Record<string, string | string[] | undefined> };

// Pull the "refreshToken=..." pair out of a Set-Cookie header.
function refreshCookie(res: CookieRes): string {
  const setCookie = res.headers['set-cookie'] as string[] | undefined;
  const cookie = setCookie?.find((c) => c.startsWith('refreshToken='));
  return cookie ? cookie.split(';')[0] : '';
}

function signup(username: string) {
  return request(app).post('/api/v1/auth/signup').send({
    username,
    email: `${username}@example.com`,
    name: 'Session Tester',
    password: 'Password123!',
  });
}

const login = (username: string) =>
  request(app)
    .post('/api/v1/auth/login')
    .send({ email: `${username}@example.com`, password: 'Password123!' });

const refresh = (cookie: string) =>
  request(app).post('/api/v1/auth/refresh-token').set('Cookie', cookie);

describe('refresh-token rotation (Redis sessions)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rotates the token and rejects the previous one (reuse detection)', async () => {
    const created = await signup('rotator');
    expect(created.status).toBe(201);
    const first = refreshCookie(created);
    expect(first).toMatch(/^refreshToken=/);

    // First refresh rotates → new cookie, old one is now stale.
    const r1 = await refresh(first);
    expect(r1.status).toBe(200);
    expect(r1.body).toHaveProperty('accessToken');
    const second = refreshCookie(r1);
    expect(second).not.toBe(first);

    // The rotated-in token still works...
    // ...but replaying the OLD token is reuse → 401 and the family is revoked.
    const reuse = await refresh(first);
    expect(reuse.status).toBe(401);

    // Reuse revoked the whole family, so even the current token now fails.
    const afterRevoke = await refresh(second);
    expect(afterRevoke.status).toBe(401);
  });

  it('logout revokes the session (refresh afterward fails)', async () => {
    const created = await signup('logouter');
    const cookie = refreshCookie(created);

    const out = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie);
    expect(out.status).toBe(204);

    const after = await refresh(cookie);
    expect(after.status).toBe(401);
  });

  it('rejects a missing/unknown refresh token', async () => {
    expect((await request(app).post('/api/v1/auth/refresh-token')).status).toBe(401);
  });

  it('logs out everywhere: revokes every session for the user', async () => {
    // Two devices: signup starts session A, a second login starts session B.
    const created = await signup('omni');
    const cookieA = refreshCookie(created);
    const accessToken = (created.body as { accessToken: string }).accessToken;

    const second = await login('omni');
    const cookieB = refreshCookie(second);
    expect(cookieB).not.toBe(cookieA);

    // Both sessions are valid beforehand (use a clone so we don't rotate the
    // ones we assert on; instead just confirm the endpoint reports two families).
    const out = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(out.status).toBe(200);
    expect((out.body as { revokedSessions: number }).revokedSessions).toBe(2);

    // Every session is now dead — neither device can refresh.
    expect((await refresh(cookieA)).status).toBe(401);
    expect((await refresh(cookieB)).status).toBe(401);
  });

  it('requires authentication to log out everywhere', async () => {
    expect((await request(app).post('/api/v1/auth/logout-all')).status).toBe(401);
  });
});
