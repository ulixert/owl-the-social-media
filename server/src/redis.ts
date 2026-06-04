import Redis from 'ioredis';

// Serving-layer client for derived views (e.g. per-post like counts). Commands
// fail fast so callers can fall back to Postgres instead of hanging when Redis
// is down; an error handler keeps an unavailable Redis from crashing the process.
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 2,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

redis.on('error', (err: Error) => {
  console.error('[redis] connection error:', err.message);
});
