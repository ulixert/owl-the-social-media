import express, { Router } from 'express';

import { protectRoute } from '../../middlewares/protectRoute.js';
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
} from './notificationController.js';

export const notificationRouter: Router = express.Router();

// Every notification route is for the authenticated user's own activity.
notificationRouter.use(protectRoute);

notificationRouter.get('/', getNotifications);
notificationRouter.get('/unread-count', getUnreadCount);
notificationRouter.post('/read', markAllRead);
notificationRouter.post('/:id/read', markRead);
