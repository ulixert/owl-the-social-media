import jwt from 'jsonwebtoken';

import { prisma } from '../db/index.js';

/** Bearer header for a user id, matching protectRoute's expectation. */
export function authHeader(userId: number): string {
  const token = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET!, {
    expiresIn: '15m',
  });
  return `Bearer ${token}`;
}

/** Wipe all tables and reset id sequences between test files. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Like","Save","Repost","UserFollows","Post","User" RESTART IDENTITY CASCADE',
  );
}

/** Create a user with predictable fields; returns the new id. */
export async function createUser(username: string): Promise<number> {
  const user = await prisma.user.create({
    data: {
      username,
      email: `${username}@example.com`,
      name: username,
      password: 'test-password',
    },
  });
  return user.id;
}
