import { describe, expect, it } from 'vitest';
import { api, loginAs, loginWithPassword } from './helpers.js';

describe('auth', () => {
  it('GET /api/health reports ok with db status', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('ok');
    expect(typeof res.body.version).toBe('string');
  });

  it('demo-login returns the student user and sets an httpOnly cookie', async () => {
    const res = await api().post('/api/auth/demo-login').send({ role: 'student' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('student');
    expect(res.body.user.email).toBe('student@demo.aieses');
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('password login works for seeded teacher and rejects wrong password', async () => {
    const ok = await loginWithPassword('teacher@demo.aieses', 'Demo@1234');
    expect(ok.user.role).toBe('teacher');
    const bad = await api().post('/api/auth/login').send({ email: 'teacher@demo.aieses', password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('UNAUTHORIZED');
  });

  it('validates login payload with a consistent error envelope', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error).toHaveProperty('message');
  });

  it('GET /api/auth/me requires a session and returns the current user with it', async () => {
    const anon = await api().get('/api/auth/me');
    expect(anon.status).toBe(401);
    const s = await loginAs('student');
    const me = await api().get('/api/auth/me').set('Cookie', s.cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(s.user.id);
    expect(me.body.user.profile.grade).toBe(6);
  });

  it('register creates a new student account and logs in', async () => {
    const email = `new.student.${Date.now()}@example.com`;
    const res = await api().post('/api/auth/register').send({ name: 'New Student', email, password: 'Str0ngPass!', role: 'student', grade: 7 });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    const dup = await api().post('/api/auth/register').send({ name: 'New Student', email, password: 'Str0ngPass!', role: 'student' });
    expect(dup.status).toBe(409);
  });

  it('register refuses to create admin accounts', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Evil', email: `evil.${Date.now()}@example.com`, password: 'Str0ngPass!', role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('logout clears the session', async () => {
    const s = await loginAs('student');
    const out = await api().post('/api/auth/logout').set('Cookie', s.cookie);
    expect(out.status).toBe(200);
    expect(String(out.headers['set-cookie'])).toMatch(/aieses_token=;|Max-Age=0|Expires=/);
  });
});
