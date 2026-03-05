import express, { Router } from 'express';

import { protectRoute } from '../../middlewares/protectRoute.js';
import {
  likeUnlikePost,
  repostUnrepost,
  saveOrUnsavePost,
} from './actionController.js';
import {
  getFollowingPosts,
  getLikedPosts,
  getRecommendedPosts,
  getSavedPosts,
} from './currentUserPostController.js';
import {
  createPost,
  deletePost,
  getChildPosts,
  getHotPosts,
  import express, { Router } from 'express';

  import { optionalProtectRoute } from '../../middlewares/optionalProtectRoute.js';
  import { protectRoute } from '../../middlewares/protectRoute.js';
  ...
  export const postRouter: Router = express.Router();

  postRouter.get('/hot', optionalProtectRoute, getHotPosts);
  postRouter.get('/following', protectRoute, getFollowingPosts);
  postRouter.get('/liked', protectRoute, getLikedPosts);
  postRouter.get('/saved', protectRoute, getSavedPosts);
  postRouter.get('/for-you', protectRoute, getRecommendedPosts);

  postRouter.get('/:postId', optionalProtectRoute, getPostById);
  postRouter.get('/:postId/comments', optionalProtectRoute, getChildPosts);

  postRouter.post('/:parentPostId', protectRoute, createPost);
  postRouter.post('/', protectRoute, createPost);

  postRouter.delete('/:postId', protectRoute, deletePost);

  // Like, save, and repost routes
  postRouter.put('/:postId/like', protectRoute, likeUnlikePost);
  postRouter.put('/:postId/save', protectRoute, saveOrUnsavePost);
  postRouter.put('/:postId/repost', protectRoute, repostUnrepost);

  // Get user posts, replies, and reposts by username
  postRouter.get('/user/:username/posts', optionalProtectRoute, getUserPosts);
  postRouter.get('/user/:username/replies', optionalProtectRoute, getUserReplies);
