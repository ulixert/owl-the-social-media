import { Router } from 'express';

import { protectRoute } from '../../middlewares/protectRoute.js';
import { apiRateLimiter, authRateLimiter } from '../../middlewares/rateLimit.js';
import {
  login,
  logout,
  logoutAll,
  refreshAccessToken,
  signup,
} from './authController.js';

export const authRouter: Router = Router();

// Credential endpoints get the tight limiter to blunt brute-force/guessing.
authRouter.post('/signup', authRateLimiter, signup);
authRouter.post('/login', authRateLimiter, login);
// POST: rotation mutates server state (issues a new refresh token).
authRouter.post('/refresh-token', authRateLimiter, refreshAccessToken);
// Non-credential routes just take the general API limiter.
authRouter.post('/logout', apiRateLimiter, logout);
// Log out everywhere — authenticated by the access token, revokes all sessions.
authRouter.post('/logout-all', apiRateLimiter, protectRoute, logoutAll);
