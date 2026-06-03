import { execSync } from 'node:child_process';

import { Client } from 'pg';

// Runs once before the whole test suite: ensures the test database exists and
// applies the current Prisma schema to it.
export default async function setup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set for tests. Create server/.env.test (see .env.test.example).',
    );
  }

  // Create the target database if it does not exist yet, connecting through the
  // default "postgres" maintenance database on the same server.
  const dbName = decodeURIComponent(new URL(url).pathname.slice(1));
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const existing = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (existing.rowCount === 0) {
      // Identifier can't be parameterized; dbName comes from our own env, not user input.
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  // Apply the schema to the (now guaranteed) test database.
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
}
