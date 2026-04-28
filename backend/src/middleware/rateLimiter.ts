import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    redisClient = new Redis(url, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1 });
    redisClient.on('error', () => { redisClient = null; });
    return redisClient;
  } catch {
    return null;
  }
}

// In-memory fallback when Redis is unavailable
const memStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(windowMs: number, max: number, keyPrefix = 'rl') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `${keyPrefix}:${req.ip}`;
    const client = getRedis();

    if (client) {
      try {
        const count = await client.incr(key);
        if (count === 1) await client.pexpire(key, windowMs);
        if (count > max) {
          return res.status(429).json({ success: false, error: 'Too many requests, try again later' });
        }
        return next();
      } catch {
        // fall through to in-memory
      }
    }

    const now = Date.now();
    const entry = memStore.get(key);
    if (!entry || now > entry.resetAt) {
      memStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ success: false, error: 'Too many requests, try again later' });
    }
    next();
  };
}
