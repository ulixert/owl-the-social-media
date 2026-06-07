import cookieParser from 'cookie-parser';
import express, { Application, NextFunction } from 'express';

import { NotFoundError } from './errors/errors.js';
import { authRouter } from './features/auth/authRouter.js';
import { notificationRouter } from './features/notification/notificationRouter.js';
import { postRouter } from './features/post/postRouter.js';
import { uploadRouter } from './features/upload/uploadRouter.js';
import { userRouter } from './features/user/userRouter.js';
import { apiRateLimiter } from './middlewares/rateLimit.js';
import { MEDIA_ROUTE, UPLOAD_DIR } from './storage/index.js';

export const app: Application = express();

// Trust the single reverse-proxy hop (Caddy / the load balancer) so req.ip
// reflects the real client from X-Forwarded-For — without this, every request
// would share the proxy's IP and rate limiting would be all-or-nothing.
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
export const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';
// The general per-IP limiter guards the JSON API. Static media below is left
// unthrottled: a single page pulls many images and they're already cached hard.
app.use(`${API_PREFIX}/users`, apiRateLimiter, userRouter);
app.use(`${API_PREFIX}/posts`, apiRateLimiter, postRouter);
app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/notifications`, apiRateLimiter, notificationRouter);
app.use(`${API_PREFIX}/upload`, apiRateLimiter, uploadRouter);

// Serve disk-backed uploads. Long-lived cache: each file has a unique name, so
// it never changes once written. (When STORAGE_DRIVER=s3, files are served by
// S3/CDN directly and this just sits idle.)
app.use(
  `${API_PREFIX}${MEDIA_ROUTE}`,
  express.static(UPLOAD_DIR, {
    immutable: true,
    maxAge: '7d',
    fallthrough: true,
  }),
);

// Catch-all for unmatched routes. A path-less middleware avoids the wildcard
// route syntax that path-to-regexp (Express 5) no longer accepts.
app.use((req, _, next: NextFunction) => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server`));
});
