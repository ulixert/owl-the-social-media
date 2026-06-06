import cookieParser from 'cookie-parser';
import express, { Application, NextFunction } from 'express';

import { NotFoundError } from './errors/errors.js';
import { authRouter } from './features/auth/authRouter.js';
import { notificationRouter } from './features/notification/notificationRouter.js';
import { postRouter } from './features/post/postRouter.js';
import { uploadRouter } from './features/upload/uploadRouter.js';
import { userRouter } from './features/user/userRouter.js';
import { MEDIA_ROUTE, UPLOAD_DIR } from './storage/index.js';

export const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
export const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';
app.use(`${API_PREFIX}/users`, userRouter);
app.use(`${API_PREFIX}/posts`, postRouter);
app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/notifications`, notificationRouter);
app.use(`${API_PREFIX}/upload`, uploadRouter);

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
