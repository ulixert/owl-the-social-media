import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { app } from '../app.js';

// Validates the whole harness end to end: the Express app loads, the .js->.ts
// resolution works, and the database connection is live.
describe('app smoke test', () => {
  it('serves the public hot feed', async () => {
    const res = await request(app).get('/api/v1/posts/hot');
    const body = res.body as { posts: unknown[]; nextCursor: number | null };

    expect(res.status).toBe(200);
    expect(Array.isArray(body.posts)).toBe(true);
    expect(body).toHaveProperty('nextCursor');
  });
});
