import { Response } from 'express';
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

const REFRESH_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export type RefreshClaims = {
  userId: number;
  username: string;
  name: string;
  profilePic: string | null;
  familyId: string; // session family (one login)
  jti: string; // this specific token within the family
};

// Sign a refresh JWT (carrying the session family + jti) and set it as the
// httpOnly cookie. Used on login/signup and on every rotation.
export function issueRefreshToken(res: Response, claims: RefreshClaims) {
  const token = jwt.sign(claims, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

  res.cookie('refreshToken', token, {
    httpOnly: true,
    maxAge: REFRESH_MAX_AGE_MS,
    sameSite: 'strict',
  });

  return token;
}

export function generateAccessToken(userId: number) {
  return jwt.sign({ userId }, ACCESS_TOKEN_SECRET, {
    expiresIn: '15m',
  });
}
