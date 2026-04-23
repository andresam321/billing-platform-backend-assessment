import { Request, Response, NextFunction } from 'express';
import { db } from '../db/inMemoryDb';

// Augment Express Request with authenticated user context
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

/**
 * Simple token-based auth middleware.
 * Token format: "Bearer <userId>"
 * In a real system this would validate a signed JWT.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token || token.trim() === '') {
    res.status(401).json({ error: 'Empty token' });
    return;
  }

  const user = db.users.find(u => u.id === token);

  if (!user) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  req.userId = user.id;
  req.userRole = user.role;
  next();
}
