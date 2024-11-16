import { Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

export function generateRefreshTokenAndSetCookie(
  res: Response,
  userId: mongoose.Types.ObjectId,
) {
  const token = jwt.sign({ userId }, REFRESH_TOKEN_SECRET, {
    expiresIn: '7d',
  });

  res.cookie('refreshToken', token, {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: 'strict', // CSRF
    secure: process.env.NODE_ENV === 'production',
    // path: `${API_PREFIX}/auth/refresh-token`,
  });

  return token;
}

export function generateAccessToken(userId: mongoose.Types.ObjectId) {
  return jwt.sign({ userId }, ACCESS_TOKEN_SECRET, {
    expiresIn: '15m',
  });
}
