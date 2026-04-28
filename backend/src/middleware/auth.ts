import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  cookies: Record<string, string>;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Prefer httpOnly cookie; fall back to Authorization header for API/mobile clients
  const cookieToken = req.cookies?.token;
  const authHeader = req.headers.authorization;
  const token = cookieToken ?? (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    // JWT_SECRET presence is enforced at startup — non-null assertion is safe here
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};
