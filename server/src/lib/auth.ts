import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { config } from '../config.js';
import type { Role } from '@shared/types';

export interface SessionClaims {
  sub: string;
  role: Role;
  name: string;
}

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, config.jwtSecret, { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'], issuer: 'aieses' });
}

export function verifySession(token: string): SessionClaims | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: 'aieses' }) as jwt.JwtPayload;
    if (!payload || typeof payload.sub !== 'string') return null;
    return { sub: payload.sub, role: payload.role as Role, name: String(payload.name ?? '') };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(config.cookieName, { path: '/' });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function hashPasswordSync(password: string): string {
  return bcrypt.hashSync(password, 8);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
