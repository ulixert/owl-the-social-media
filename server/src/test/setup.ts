import { afterAll } from 'vitest';

import { prisma } from '../db/index.js';
import { redis } from '../redis.js';

// Close the shared connections once all tests in a file have run, so the
// process can exit. disconnect() is immediate and safe even if Redis never
// connected.
afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});
