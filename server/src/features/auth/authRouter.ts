import { Router } from 'express';

import { protectRoute } from '../../middlewares/protectRoute.js';
import {
  login,
  logout,
  logoutAll,
  refreshAccessToken,
  signup,
} from './authController.js';

export const authRouter: Router = Router();

authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
// Log out everywhere — authenticated by the access token, revokes all sessions.
authRouter.post('/logout-all', protectRoute, logoutAll);
// POST: rotation mutates server state (issues a new refresh token).
authRouter.post('/refresh-token', refreshAccessToken);
