import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Load a .env file from the repo root if present (no external dependency). */
function loadDotEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const text = fs.readFileSync(file, 'utf8');
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
      }
    } catch {
      /* ignore malformed .env */
    }
    break;
  }
}
loadDotEnv();

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const isTest = env.NODE_ENV === 'test' || !!env.VITEST;

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

let jwtSecret = env.JWT_SECRET || '';
let jwtSecretGenerated = false;
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(48).toString('hex');
  jwtSecretGenerated = true;
}

export const config = {
  isProd,
  isTest,
  port: Number(env.PORT || 4000),
  databasePath: isTest ? ':memory:' : env.DATABASE_PATH || path.resolve(process.cwd(), 'data/aieses.sqlite'),
  jwtSecret,
  jwtSecretGenerated,
  jwtExpiresIn: '7d',
  cookieName: 'aieses_token',
  cookieSecure: bool(env.COOKIE_SECURE, false),
  trustProxy: bool(env.TRUST_PROXY, false),
  allowedOrigins: (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  demoMode: bool(env.DEMO_MODE, true),
  resetDbOnBoot: bool(env.RESET_DB_ON_BOOT, false),
  ai: {
    provider: (env.AI_PROVIDER || 'demo') as 'demo' | 'openai-compatible',
    baseUrl: env.AI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: env.AI_API_KEY || '',
    model: env.AI_MODEL || 'gpt-4o-mini',
    timeoutMs: Number(env.AI_TIMEOUT_MS || 20000),
  },
  diksha: {
    mode: (env.DIKSHA_MODE || 'mock') as 'mock' | 'live',
    baseUrl: env.DIKSHA_BASE_URL || 'https://diksha.gov.in',
  },
  exec: {
    provider: (env.EXEC_PROVIDER || 'simulated') as 'simulated' | 'piston',
    pistonBaseUrl: env.PISTON_BASE_URL || 'https://emkc.org/api/v2/piston',
    timeoutMs: Number(env.EXEC_TIMEOUT_MS || 5000),
    maxCodeBytes: 20_000,
    maxOutputBytes: 10_000,
  },
  limits: {
    maxDocumentBytes: 200_000,
    maxFileBytes: 100_000,
    maxAiMessageChars: 2000,
  },
  clientDist: path.resolve(__dirname, '../../client/dist'),
  version: '0.1.0',
};

export type AppConfig = typeof config;
