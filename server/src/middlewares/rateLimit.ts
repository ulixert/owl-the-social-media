import { NextFunction, Request, Response } from 'express';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';

import { HttpStatusCode } from '../constants/constants.js';
import { redis } from '../redis.js';

type RateLimitOptions = {
  // Namespaces the counters in Redis so different limiters don't collide.
  keyPrefix: string;
  // Allow `points` requests per `duration` seconds, per key.
  points: number;
  duration: number;
  // How long to keep blocking once the limit is hit (defaults to `duration`).
  blockDuration?: number;
  // Derives the per-request bucket key. Defaults to the client IP.
  keyGenerator?: (req: Request) => string;
};

function setHeaders(res: Response, points: number, info: RateLimiterRes): void {
  res.setHeader('RateLimit-Limit', points);
  res.setHeader('RateLimit-Remaining', info.remainingPoints);
  res.setHeader('RateLimit-Reset', Math.ceil(info.msBeforeNext / 1000));
}

// Builds an Express middleware backed by a shared Redis counter, so the limit
// holds across every server instance behind the load balancer (an in-memory
// counter would let each replica grant the full quota independently).
export function createRateLimiter({
  keyPrefix,
  points,
  duration,
  blockDuration,
  keyGenerator = (req) => req.ip ?? 'unknown',
}: RateLimitOptions) {
  const limiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration,
    blockDuration,
  });

  return async function rateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const info = await limiter.consume(keyGenerator(req));
      setHeaders(res, points, info);
      next();
    } catch (err) {
      if (err instanceof RateLimiterRes) {
        setHeaders(res, points, err);
        res.setHeader('Retry-After', Math.ceil(err.msBeforeNext / 1000));
        res.status(HttpStatusCode.TOO_MANY_REQUESTS).json({
          message: 'Too many requests. Please slow down and try again shortly.',
        });
        return;
      }

      // Store error (e.g. Redis is down). Fail open so an outage can't lock
      // every client out — the serving layer already falls back to Postgres
      // when Redis is unavailable, and rate limiting follows the same posture.
      console.error('[rateLimit] limiter error, allowing request:', err);
      next();
    }
  };
}

// General per-IP cap for the API surface. Generous enough for normal browsing
// (a single page fans out into several calls) while still bounding abuse.
export const apiRateLimiter = createRateLimiter({
  keyPrefix: 'rl:api',
  points: 100,
  duration: 60,
});

// Tight per-IP cap for credential endpoints (login/signup/refresh) to blunt
// brute-force and token-guessing; a tripped limit stays blocked for a minute.
export const authRateLimiter = createRateLimiter({
  keyPrefix: 'rl:auth',
  points: 10,
  duration: 60,
  blockDuration: 60,
});
