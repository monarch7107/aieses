import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import type { Role } from '@shared/types';

let app: Express | null = null;

/** One in-memory app per test process (vitest runs files sequentially; DB is :memory: under NODE_ENV=test). */
export function getApp(): Express {
  if (!app) app = createApp({ seedDemo: true, serveClient: false });
  return app;
}

export interface Session {
  cookie: string;
  user: { id: string; name: string; role: Role; email: string };
}

export async function loginAs(role: Role): Promise<Session> {
  const res = await request(getApp()).post('/api/auth/demo-login').send({ role });
  if (res.status !== 200) throw new Error(`demo-login failed: ${res.status} ${JSON.stringify(res.body)}`);
  const setCookie = res.headers['set-cookie'] as unknown as string[] | string | undefined;
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
  return { cookie, user: res.body.user };
}

export async function loginWithPassword(email: string, password: string): Promise<Session> {
  const res = await request(getApp()).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  const setCookie = res.headers['set-cookie'] as unknown as string[] | string | undefined;
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return { cookie: cookies.map((c) => c.split(';')[0]).join('; '), user: res.body.user };
}

export const api = () => request(getApp());
