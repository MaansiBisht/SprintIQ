import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

const loginRateLimit = rateLimiter(15 * 60 * 1000, 10, 'login');

router.post('/login', loginRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const result = await query('SELECT * FROM admins WHERE email = $1', [email]);
    const admin = result.rows[0];

    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: admin.id },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    await query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      user: { id: admin.id, email: admin.email },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  res.json({ success: true, message: 'Logged out' });
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT id, email, last_login FROM admins WHERE id = $1', [req.userId]);
    const admin = result.rows[0];

    if (!admin) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user: admin });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
