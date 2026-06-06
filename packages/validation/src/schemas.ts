import { z } from 'zod';

// An image location: either an absolute URL (external / S3) or a relative media
// path served by the API (disk storage returns e.g. "/api/v1/media/<id>.jpg").
// z.string().url() rejects relative paths, which broke posting/profile-pic
// updates for uploaded images.
const mediaUrl = z
  .string()
  .refine((s) => /^https?:\/\//.test(s) || s.startsWith('/'), {
    message: 'Must be an absolute URL or a relative media path',
  });

/////////////////////////////////////////
// Role Schema
/////////////////////////////////////////
export const RoleSchema = z.enum(['USER', 'ADMIN']);

/////////////////////////////////////////
// User schema
/////////////////////////////////////////
export const UserSchema = z.object({
  id: z.number().int(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(20, 'Password must be at most 20 characters'),
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(20, 'Name must be at most 20 characters'),
  role: RoleSchema.default('USER'),
  active: z.boolean().default(true),
  profilePic: mediaUrl.nullable().default(null),
  biography: z.string().nullable().default(null),
  followingCount: z.number().int().default(0),
  followersCount: z.number().int().default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const UserCreateSchema = UserSchema.pick({
  username: true,
  email: true,
  password: true,
  name: true,
});

export const UserUpdateSchema = UserSchema.partial().pick({
  name: true,
  profilePic: true,
  biography: true,
});

export const LoginSchema = UserSchema.pick({
  email: true,
  password: true,
});

/////////////////////////////////////////
// Post schema
/////////////////////////////////////////
export const PostSchema = z.object({
  id: z.number().int(),
  postedById: z.number().int(),
  parentPostId: z.number().int().nullable(),
  text: z.string().max(280).optional(),
  images: z.array(mediaUrl).optional(),
  likesCount: z.number().default(0),
  commentsCount: z.number().default(0),
  repostsCount: z.number().default(0),
  isDeleted: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const PostCreateSchema = PostSchema.pick({
  text: true,
  images: true,
}).refine(
  (data) =>
    Boolean(data.text) || data.images === undefined || data.images.length > 0,
  {
    message: "At least 'text' or 'images' must be provided.",
    path: ['text', 'images'],
  },
);

export const PostUpdateSchema = PostSchema.partial()
  .pick({
    text: true,
    images: true,
  })
  .refine(
    (data) =>
      Boolean(data.text) || data.images === undefined || data.images.length > 0,
    {
      message: "At least 'text' or 'images' must be provided.",
    },
  );

/////////////////////////////////////////
// User Follows Schema
/////////////////////////////////////////
export const UserFollowsSchema = z.object({
  id: z.number().int(),
  followerId: z.number().int(),
  followingId: z.number().int(),
});

/////////////////////////////////////////
// Like Schema
/////////////////////////////////////////
export const LikeSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  postId: z.number().int(),
  createdAt: z.coerce.date(),
});

/////////////////////////////////////////
// Repost Schema
/////////////////////////////////////////
export const RepostSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  postId: z.number().int(),
  originalPostId: z.number().int(),
  originalAuthorId: z.number().int(),
  createdAt: z.coerce.date(),
});

/////////////////////////////////////////
// Save Schema
/////////////////////////////////////////
export const SaveSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  postId: z.number().int(),
  createdAt: z.coerce.date(),
});
