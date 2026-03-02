import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { LoginSchema, UserCreateSchema } from 'validation';

import argon2 from '@node-rs/argon2';

import { prisma } from '../../db';
import { jwtVerify } from '../../middlewares/utils/jwtVerify.js';
import {
  generateAccessToken,
  generateRefreshTokenAndSetCookie,
} from '../../utils/generateTokenAndSetCookie.js';
import { checkPassword } from './utils/checkPassword.js';

export async function login(req: Request, res: Response) {
  try {
    // Validate input
    const input = LoginSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({
        message: 'Invalid user data',
      });
      return;
    }

    const { email, password } = input.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { password: true, id: true, username: true, profilePic: true },
    });
    if (!user) {
      res.status(400).json({
        message: 'Invalid email or password',
      });
      return;
    }

    // Check if password is correct
    const isPasswordCorrect = await checkPassword(user.password, password);
    if (!isPasswordCorrect) {
      res.status(400).json({
        message: 'Invalid email or password',
      });
      return;
    }

    // Generate tokens
    generateRefreshTokenAndSetCookie(
      res,
      user.id,
      user.username,
      user.profilePic,
    );
    res.status(200).json({
      accessToken: generateAccessToken(user.id),
      userId: user.id,
      username: user.username,
      profilePic: user.profilePic,
    });
  } catch (error) {
    res.status(500).json({ message: 'An unknown error occurred.' });
    console.error('Error in login: ', error);
  }
}

export function logout(_req: Request, res: Response) {
  try {
    res.clearCookie('refreshToken').status(204).send();
  } catch (error) {
    res.status(500).json({
      message: 'An unknown error occurred.',
    });
    console.error('Error in logout: ', error);
  }
}

export async function signup(req: Request, res: Response) {
  try {
    // Validate input
    const input = UserCreateSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ message: 'Invalid user data' });
      return;
    }

    // Check if user already exists
    const { username, email, password, name } = input.data;
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      res.status(400).json({
        message: 'User already exists',
      });
      return;
    }

    // Create new user
    const hashedPassword = await argon2.hash(password);

    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        name,
      },
    });

    generateRefreshTokenAndSetCookie(
      res,
      newUser.id,
      newUser.username,
      newUser.profilePic,
    );
    res.status(201).json({
      accessToken: generateAccessToken(newUser.id),
      userId: newUser.id,
      username: newUser.username,
      profilePic: newUser.profilePic,
    });
  } catch (error) {
    res.status(500).json({
      message: 'An unknown error occurred.',
    });
    console.error('Error in signup: ', error);
  }
}

// Token Refresh Function
export async function refreshAccessToken(req: Request, res: Response) {
  try {
    const token =
      typeof req.cookies?.refreshToken === 'string'
        ? req.cookies.refreshToken
        : undefined;
    if (!token) {
      res.status(401).json({
        message: 'Refresh token not found',
      });
      return;
    }

    const { userId, username, profilePic } = await jwtVerify(
      token,
      process.env.REFRESH_TOKEN_SECRET!,
    );

    const accessToken = generateAccessToken(userId);

    res.status(200).json({ accessToken, userId, username, profilePic });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        message: 'Refresh token expired. Please log in again.',
      });
      return;
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        message: 'Invalid refresh token. Please log in again.',
      });
      return;
    }

    console.error('Error in refreshAccessToken:', error);
    res.status(500).json({
      message: 'An unknown error occurred.',
    });
  }
}
