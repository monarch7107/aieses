import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { verifySession, type SessionClaims } from '../lib/auth.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { q } from '../db/index.js';
import type { Role } from '@shared/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: SessionClaims;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  if (cookies && cookies[config.cookieName]) return cookies[config.cookieName];
  return null;
}

/** Attaches req.session when a valid token is present; never rejects. */
export function attachSession(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    const claims = verifySession(token);
    if (claims) {
      // Ensure the user still exists (roles may have been changed by an admin).
      const user = q.get<{ role: Role; name: string }>('SELECT role, name FROM users WHERE id = ?', claims.sub);
      if (user) req.session = { sub: claims.sub, role: user.role, name: user.name };
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session) return next(unauthorized());
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.session) return next(unauthorized());
    if (!roles.includes(req.session.role)) return next(forbidden(`This action requires role: ${roles.join(' or ')}`));
    next();
  };
}

/** Basic CSRF defence for cookie sessions: reject cross-origin state-changing requests in production. */
export function originCheck(req: Request, _res: Response, next: NextFunction): void {
  if (!config.isProd && !config.isTest) return next(); // dev: Vite proxy / preview hosts vary
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // non-browser clients (tests, curl) — cookies are not auto-attached cross-site anyway
  try {
    const originHost = new URL(origin).host;
    const forwarded = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
    const host = forwarded || req.headers.host || '';
    if (originHost === host || config.allowedOrigins.includes(origin)) return next();
  } catch {
    /* fallthrough */
  }
  next(forbidden('Cross-origin request rejected'));
}

export function isSelfOrRole(req: Request, userId: string, ...roles: Role[]): boolean {
  if (!req.session) return false;
  return req.session.sub === userId || roles.includes(req.session.role);
}
