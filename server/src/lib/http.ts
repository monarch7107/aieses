import type { Request } from 'express';
import type { ZodType } from 'zod';
import crypto from 'node:crypto';
import { badRequest, validationError } from './errors.js';

/** Validate `data` with a zod schema, throwing a 400 with field details on failure. */
export function validate<T>(schema: ZodType<T>, data: unknown, what = 'request'): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw validationError(`Invalid ${what}: ${issues.map((i) => `${i.path || 'value'} ${i.message}`).join('; ')}`, issues);
  }
  return result.data;
}

export function newId(prefix?: string): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id.slice(0, 12)}` : id;
}

export function paramString(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !value) throw badRequest(`Missing route parameter ${name}`);
  return value;
}

export function queryString(req: Request, name: string): string | undefined {
  const value = req.query[name];
  if (typeof value === 'string' && value.length > 0) return value;
  return undefined;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
