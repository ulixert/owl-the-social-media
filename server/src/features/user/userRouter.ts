import express, { Router } from 'express';

import { optionalProtectRoute } from '../../middlewares/optionalProtectRoute.js';
import { protectRoute } from '../../middlewares/protectRoute.js';
import {
  followAndUnfollowUser,
  getMyData,
  getRecommendedUsers,
  getUserProfile,
  updateUserProfile,
} from './userController.js';

export const userRouter: Router = express.Router();

// Static paths must precede the `/:username` param route so they aren't
// swallowed as a username.
userRouter.get('/recommended', optionalProtectRoute, getRecommendedUsers);

userRouter.get('/:username', optionalProtectRoute, getUserProfile);
userRouter.put('/follow/:id', protectRoute, followAndUnfollowUser);
userRouter.put('/me/profile', protectRoute, updateUserProfile);
userRouter.get('/me/data', protectRoute, getMyData);
