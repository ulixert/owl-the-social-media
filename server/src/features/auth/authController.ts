import { Request, Response } from 'express';
import { LoginSchema, UserCreateSchema } from 'validation';

import argon2 from '@node-rs/argon2';

import { prisma } from '../../db';
import { JWTError } from '../../errors/errors.js';
import { jwtVerify } from '../../middlewares/utils/jwtVerify.js';
import {
  generateAccessToken,
  issueRefreshToken,
} from '../../utils/generateTokenAndSetCookie.js';
import { createSession, revokeSession, rotateSession } from './session.js';
import { checkPassword } from './utils/checkPassword.js';

type AuthUser = {
  id: number;
  username: string;
  name: string;
  profilePic: string | null;
};

// Start a session, set the rotating refresh cookie, and return the auth payload.
async function issueSession(res: Response, user: AuthUser) {
  const { familyId, jti } = await createSession();
  issueRefreshToken(res, {
    userId: user.id,
    username: user.username,
    name: user.name,
    profilePic: user.profilePic,
    familyId,
    jti,
  });
  return {
    accessToken: generateAccessToken(user.id),
    userId: user.id,
    username: user.username,
    name: user.name,
    profilePic: user.profilePic,
  };
}

export async function login(req: Request, res: Response) {
  try {
    const input = LoginSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid user data' });
      return;
    }

    const { email, password } = input.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        password: true,
        id: true,
        username: true,
        name: true,
        profilePic: true,
      },
    });
    if (!user) {
      res.status(400).json({ message: 'Invalid email or password' });
      return;
    }

    const isPasswordCorrect = await checkPassword(user.password, password);
    if (!isPasswordCorrect) {
      res.status(400).json({ message: 'Invalid email or password' });
      return;
    }

    res.status(200).json(await issueSession(res, user));
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred.' });
    console.error('Error in login: ', error);
  }
}

export async function signup(req: Request, res: Response) {
  try {
    const input = UserCreateSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid user data' });
      return;
    }

    const { username, email, password, name } = input.data;
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existingUser) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const hashedPassword = await argon2.hash(password);
    const newUser = await prisma.user.create({
      data: { email, username, password: hashedPassword, name },
    });

    res.status(201).json(await issueSession(res, newUser));
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred.' });
    console.error('Error in signup: ', error);
  }
}

// Best-effort revoke: kill the session family in Redis, then always clear the
// cookie (even if the token is unverifiable, so the client ends up logged out).
export async function logout(req: Request, res: Response) {
  try {
    const token =
      typeof req.cookies?.refreshToken === 'string'
        ? req.cookies.refreshToken
        : undefined;
    if (token) {
      try {
        const { familyId } = await jwtVerify(
          token,
          process.env.REFRESH_TOKEN_SECRET!,
        );
        if (familyId) await revokeSession(familyId);
      } catch {
        // ignore — clear the cookie regardless
      }
    }
    res.clearCookie('refreshToken').status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred.' });
    console.error('Error in logout: ', error);
  }
}

// Rotating refresh: verify the JWT, then require its jti to match the family's
// current jti in Redis. Match → rotate (new jti + cookie). Stale jti → reuse
// detected (the family is revoked). Missing family → revoked/expired/logged out.
export async function refreshAccessToken(req: Request, res: Response) {
  try {
    const token =
      typeof req.cookies?.refreshToken === 'string'
        ? req.cookies.refreshToken
        : undefined;
    if (!token) {
      res.status(401).json({ message: 'Refresh token not found' });
      return;
    }

    let payload;
    try {
      payload = await jwtVerify(token, process.env.REFRESH_TOKEN_SECRET!);
    } catch (err) {
      if (err instanceof JWTError) {
        res.status(401).json({ message: 'Invalid or expired refresh token.' });
        return;
      }
      throw err;
    }

    const { userId, username, name, profilePic, familyId, jti } = payload;
    if (!familyId || !jti) {
      // Pre-rotation token (no session) — force a fresh login.
      res.status(401).json({ message: 'Please log in again.' });
      return;
    }

    const result = await rotateSession(familyId, jti);
    if (result.status !== 'rotated') {
      res.status(401).json({
        message:
          result.status === 'reuse'
            ? 'Refresh token reuse detected. Please log in again.'
            : 'Session expired. Please log in again.',
      });
      return;
    }

    issueRefreshToken(res, {
      userId,
      username,
      name,
      profilePic,
      familyId,
      jti: result.jti,
    });
    res.status(200).json({
      accessToken: generateAccessToken(userId),
      userId,
      username,
      name,
      profilePic,
    });
  } catch (error) {
    console.error('Error in refreshAccessToken:', error);
    res.status(500).json({ message: 'An unknown error occurred.' });
  }
}
