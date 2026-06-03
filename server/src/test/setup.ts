import { afterAll } from 'vitest';

import { prisma } from '../db/index.js';

// Close the shared Prisma connection pool once all tests in a file have run.
afterAll(async () => {
  await prisma.$disconnect();
});
