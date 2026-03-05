import { NextFunction, Request, Response } from 'express';
import { prisma } from '../db';
import { jwtVerify } from './utils/jwtVerify.js';

export async function optionalProtectRoute(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next();
    }

    const { userId } = await jwtVerify(token, process.env.ACCESS_TOKEN_SECRET!);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      req.user = user;
    }
    next();
  } catch (error) {
    // If token is invalid, we just proceed as unauthenticated
    next();
  }
}
