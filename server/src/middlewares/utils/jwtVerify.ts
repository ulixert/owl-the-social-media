import jwt from 'jsonwebtoken';

import { JWTError } from '../../errors/errors.js';

type JwtPayload = {
  userId: number;
  username: string;
  name: string;
  profilePic: string | null;
  iat: number;
  exp: number;
};

export async function jwtVerify(
  token: string,
  secret: string,
): Promise<JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err || !decoded || typeof decoded !== 'object') {
        return reject(new JWTError(err?.message ?? 'Invalid JWT token'));
      }
      resolve(decoded as JwtPayload);
    });
  });
}
