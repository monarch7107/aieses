import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { nowIso, q } from '../db/index.js';
import { clearSessionCookie, hashPassword, setSessionCookie, signSession, verifyPassword } from '../lib/auth.js';
import { conflict, forbidden, unauthorized } from '../lib/errors.js';
import { newId, validate } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { DEMO_ACCOUNTS } from '../db/seed.js';
import { getUserById } from './users.js';
import type { Role } from '@shared/types';

export const authRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => config.isTest });

const loginSchema = z.object({ email: z.string().trim().min(3).max(200), password: z.string().min(1).max(200) });
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  role: z.enum(['student', 'teacher']).default('student'),
  grade: z.number().int().min(1).max(12).optional(),
});

function issueSession(res: Parameters<typeof setSessionCookie>[0], user: { id: string; role: Role; name: string }) {
  const token = signSession({ sub: user.id, role: user.role, name: user.name });
  setSessionCookie(res, token);
  return token;
}

authRouter.post('/login', loginLimiter, async (req, res) => {
  const body = validate(loginSchema, req.body, 'login');
  const user = q.get<{ id: string; password_hash: string; role: Role; name: string }>('SELECT id, password_hash, role, name FROM users WHERE email = ?', body.email);
  const ok = user ? await verifyPassword(body.password, user.password_hash) : false;
  if (!user || !ok) throw unauthorized('Invalid email or password');
  const token = issueSession(res, user);
  res.json({ user: getUserById(user.id), token });
});

authRouter.post('/register', loginLimiter, async (req, res) => {
  const body = validate(registerSchema, req.body, 'registration');
  if (q.get('SELECT 1 FROM users WHERE email = ?', body.email)) throw conflict('An account with this email already exists');
  const id = newId('usr');
  const colors = ['#2563eb', '#16a34a', '#7c3aed', '#ea580c', '#db2777', '#0891b2'];
  q.run(
    'INSERT INTO users (id, email, password_hash, name, role, language, avatar_color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, body.email, await hashPassword(body.password), body.name, body.role, 'en', colors[Math.floor(Math.random() * colors.length)], nowIso(),
  );
  if (body.role === 'student') q.run('INSERT INTO student_profiles (user_id, grade, school) VALUES (?, ?, ?)', id, body.grade ?? 6, '');
  else q.run('INSERT INTO teacher_profiles (user_id, school, subjects_json) VALUES (?, ?, ?)', id, '', '[]');
  const token = issueSession(res, { id, role: body.role, name: body.name });
  res.status(201).json({ user: getUserById(id), token });
});

/** One-click demo login (synthetic accounts). Disabled with DEMO_MODE=false. */
authRouter.post('/demo-login', loginLimiter, (req, res) => {
  if (!config.demoMode) throw forbidden('Demo mode is disabled');
  const { role } = validate(z.object({ role: z.enum(['student', 'teacher', 'admin']) }), req.body, 'demo login');
  const account = DEMO_ACCOUNTS[role];
  const user = q.get<{ id: string; role: Role; name: string }>('SELECT id, role, name FROM users WHERE id = ?', account.id);
  if (!user) throw unauthorized('Demo account not seeded');
  const token = issueSession(res, user);
  res.json({ user: getUserById(user.id), token });
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: getUserById(req.session!.sub) });
});

authRouter.get('/demo-accounts', (_req, res) => {
  if (!config.demoMode) return res.json({ enabled: false, accounts: [] });
  res.json({
    enabled: true,
    accounts: (Object.keys(DEMO_ACCOUNTS) as Role[]).map((role) => ({ role, email: DEMO_ACCOUNTS[role].email, name: DEMO_ACCOUNTS[role].name })),
  });
});
