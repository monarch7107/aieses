import { Router } from 'express';
import { z } from 'zod';
import { parseJson, q } from '../db/index.js';
import { forbidden, notFound } from '../lib/errors.js';
import { paramString, validate } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { teacherCanSeeStudent } from '../services/analytics.js';
import type { LanguageCode, Role, User } from '@shared/types';

export function getUserById(id: string): User | null {
  const u = q.get<{ id: string; email: string; name: string; role: Role; language: LanguageCode; avatar_color: string; created_at: string }>(
    'SELECT id, email, name, role, language, avatar_color, created_at FROM users WHERE id = ?',
    id,
  );
  if (!u) return null;
  let profile: User['profile'] = null;
  if (u.role === 'student') {
    const p = q.get<{ grade: number; school: string; points: number; streak_days: number; bio: string | null }>('SELECT * FROM student_profiles WHERE user_id = ?', id);
    if (p) profile = { userId: id, grade: p.grade, school: p.school, points: p.points, streakDays: p.streak_days, bio: p.bio };
  } else if (u.role === 'teacher') {
    const p = q.get<{ school: string; subjects_json: string }>('SELECT * FROM teacher_profiles WHERE user_id = ?', id);
    if (p) profile = { userId: id, school: p.school, subjects: parseJson<string[]>(p.subjects_json, []) };
  }
  return { id: u.id, email: u.email, name: u.name, role: u.role, language: u.language, avatarColor: u.avatar_color, createdAt: u.created_at, profile };
}

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/', requireRole('admin'), (req, res) => {
  const role = typeof req.query.role === 'string' ? req.query.role : undefined;
  const rows = q.all<{ id: string }>('SELECT id FROM users WHERE (? IS NULL OR role = ?) ORDER BY role, name', role ?? null, role ?? null);
  res.json({ users: rows.map((r) => getUserById(r.id)).filter(Boolean) });
});

usersRouter.get('/me', (req, res) => {
  res.json({ user: getUserById(req.session!.sub) });
});

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  language: z.enum(['en', 'hi', 'ta', 'unr']).optional(),
  bio: z.string().max(280).optional(),
});

usersRouter.patch('/me', (req, res) => {
  const body = validate(patchSchema, req.body, 'profile update');
  const id = req.session!.sub;
  if (body.name) q.run('UPDATE users SET name = ? WHERE id = ?', body.name, id);
  if (body.language) q.run('UPDATE users SET language = ? WHERE id = ?', body.language, id);
  if (body.bio !== undefined) q.run('UPDATE student_profiles SET bio = ? WHERE user_id = ?', body.bio, id);
  res.json({ user: getUserById(id) });
});

usersRouter.get('/:id', (req, res) => {
  const id = paramString(req, 'id');
  const s = req.session!;
  if (s.sub !== id && s.role !== 'admin' && !(s.role === 'teacher' && teacherCanSeeStudent(s.sub, id, s.role))) throw forbidden();
  const user = getUserById(id);
  if (!user) throw notFound('User');
  res.json({ user });
});

usersRouter.patch('/:id/role', requireRole('admin'), (req, res) => {
  const id = paramString(req, 'id');
  const { role } = validate(z.object({ role: z.enum(['student', 'teacher', 'admin']) }), req.body, 'role update');
  if (id === req.session!.sub) throw forbidden('You cannot change your own role');
  const user = getUserById(id);
  if (!user) throw notFound('User');
  q.run('UPDATE users SET role = ? WHERE id = ?', role, id);
  if (role === 'student' && !q.get('SELECT 1 FROM student_profiles WHERE user_id = ?', id)) q.run('INSERT INTO student_profiles (user_id, grade, school) VALUES (?, 6, ?)', id, '');
  if (role === 'teacher' && !q.get('SELECT 1 FROM teacher_profiles WHERE user_id = ?', id)) q.run('INSERT INTO teacher_profiles (user_id, school, subjects_json) VALUES (?, ?, ?)', id, '', '[]');
  res.json({ user: getUserById(id) });
});
