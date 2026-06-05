import { Router } from 'express';

import { login, logout, refreshAccessToken, signup } from './authController.js';

export const authRouter: Router = Router();

authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
// POST: rotation mutates server state (issues a new refresh token).
authRouter.post('/refresh-token', refreshAccessToken);
