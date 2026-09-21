/**
 * AI tutor, code execution, DIKSHA, i18n, admin and health routes.
 */
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { nowIso, q } from '../db/index.js';
import { badRequest, forbidden } from '../lib/errors.js';
import { newId, paramString, queryString, validate } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { chat, deleteConversation, getConversation, listConversations } from '../services/ai/tutor.js';
import { providerStatus } from '../services/ai/provider.js';
import { BROWSER_LANGUAGES, SERVER_LANGUAGES, executionStatus, getExecutionAdapter, screenCode } from '../services/execution/index.js';
import { getDikshaAdapter } from '../services/diksha.js';
import { languageCatalogue, speechProviders, getTranslationProvider } from '../services/i18n.js';
import { adminStats } from '../services/analytics.js';
import { logActivity } from '../services/progress.js';
import { seed } from '../db/seed.js';
import { pdfFontSupport } from '../services/pdf.js';
import type { ExecutionResult } from '@shared/types';

const aiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => config.isTest });
const execLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => config.isTest });

// ---- AI ------------------------------------------------------------------------
export const aiRouter = Router();
aiRouter.use(requireAuth);

const chatSchema = z.object({
  message: z.string().min(1).max(config.limits.maxAiMessageChars + 500),
  intent: z.enum(['explain', 'simpler', 'example', 'practice', 'recommend', 'general', 'answer']).nullable().optional(),
  conversationId: z.string().max(100).nullable().optional(),
  context: z
    .object({
      lessonId: z.string().max(100).nullable().optional(),
      courseId: z.string().max(100).nullable().optional(),
      subjectId: z.string().max(100).nullable().optional(),
    })
    .optional(),
  language: z.enum(['en', 'hi', 'ta', 'unr']).optional(),
});

aiRouter.get('/status', (_req, res) => res.json({ ai: providerStatus() }));

aiRouter.post('/chat', aiLimiter, async (req, res) => {
  const body = validate(chatSchema, req.body, 'chat message');
  const language = body.language ?? (q.get<{ language: string }>('SELECT language FROM users WHERE id = ?', req.session!.sub)?.language as 'en' | 'hi' | 'ta' | 'unr') ?? 'en';
  const out = await chat({ userId: req.session!.sub, userName: req.session!.name, message: body.message, intent: body.intent ?? null, conversationId: body.conversationId ?? null, context: body.context, language });
  if (req.session!.role === 'student') logActivity(req.session!.sub, 'ai_chat', out.conversationId);
  res.json(out);
});

aiRouter.get('/conversations', (req, res) => res.json({ conversations: listConversations(req.session!.sub) }));
aiRouter.get('/conversations/:id', (req, res) => res.json({ conversation: getConversation(req.session!.sub, paramString(req, 'id')) }));
aiRouter.delete('/conversations/:id', (req, res) => {
  deleteConversation(req.session!.sub, paramString(req, 'id'));
  res.json({ ok: true });
});

// ---- Code execution --------------------------------------------------------------
export const executionsRouter = Router();
executionsRouter.use(requireAuth);

executionsRouter.get('/status', (_req, res) => res.json({ execution: executionStatus() }));

const runSchema = z.object({
  language: z.enum(['javascript', 'python', 'c', 'java']),
  code: z.string().max(config.exec.maxCodeBytes + 1000),
  stdin: z.string().max(5000).optional(),
  projectId: z.string().max(100).nullable().optional(),
  fileId: z.string().max(100).nullable().optional(),
});

function recordExecution(userId: string, result: ExecutionResult, projectId?: string | null, fileId?: string | null): string {
  const id = newId('exe');
  q.run(
    'INSERT INTO code_executions (id, user_id, project_id, file_id, language, runner, status, stdout, stderr, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, userId, projectId ?? null, fileId ?? null, result.language, result.runner, result.status, result.stdout.slice(0, config.exec.maxOutputBytes), result.stderr.slice(0, config.exec.maxOutputBytes), result.durationMs, nowIso(),
  );
  logActivity(userId, 'code_run', id);
  return id;
}

/** Server-side execution for languages without a browser sandbox. Never runs code on the host process. */
executionsRouter.post('/run', execLimiter, async (req, res) => {
  const body = validate(runSchema, req.body, 'run request');
  if (BROWSER_LANGUAGES.includes(body.language)) {
    throw badRequest(`${body.language} runs in the browser sandbox; the server does not execute it. Record the result via POST /api/executions instead.`);
  }
  if (!SERVER_LANGUAGES.includes(body.language)) throw badRequest('Unsupported language');
  const screen = screenCode(body.code);
  if (!screen.ok) {
    const blocked: ExecutionResult = { language: body.language, runner: 'simulated', runnerLabel: 'Blocked by static screen', simulated: true, status: 'blocked', stdout: '', stderr: screen.reason, durationMs: 0 };
    return res.status(200).json({ result: { ...blocked, id: recordExecution(req.session!.sub, blocked, body.projectId, body.fileId) } });
  }
  const result = await getExecutionAdapter().run({ language: body.language, code: body.code, stdin: body.stdin });
  const id = recordExecution(req.session!.sub, result, body.projectId, body.fileId);
  res.json({ result: { ...result, id } });
});

/** Record a browser-sandbox run (JavaScript Web Worker / Pyodide) for progress and teacher visibility. */
executionsRouter.post('/', (req, res) => {
  const body = validate(
    z.object({
      language: z.enum(['javascript', 'python', 'c', 'java']),
      runner: z.enum(['browser-worker', 'pyodide-wasm', 'simulated', 'piston']),
      status: z.enum(['success', 'error', 'timeout', 'blocked']),
      stdout: z.string().max(config.exec.maxOutputBytes * 2).default(''),
      stderr: z.string().max(config.exec.maxOutputBytes * 2).default(''),
      durationMs: z.number().int().min(0).max(600000).default(0),
      projectId: z.string().max(100).nullable().optional(),
      fileId: z.string().max(100).nullable().optional(),
    }),
    req.body,
    'execution record',
  );
  const result: ExecutionResult = { language: body.language, runner: body.runner, runnerLabel: body.runner, simulated: body.runner === 'simulated', status: body.status, stdout: body.stdout, stderr: body.stderr, durationMs: body.durationMs };
  const id = recordExecution(req.session!.sub, result, body.projectId, body.fileId);
  res.status(201).json({ id });
});

executionsRouter.get('/me', (req, res) => {
  const rows = q.all<{ id: string; language: string; runner: string; status: string; duration_ms: number; created_at: string; file_id: string | null }>(
    'SELECT id, language, runner, status, duration_ms, created_at, file_id FROM code_executions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
    req.session!.sub,
  );
  res.json({ executions: rows.map((r) => ({ id: r.id, language: r.language, runner: r.runner, status: r.status, durationMs: r.duration_ms, createdAt: r.created_at, fileId: r.file_id })) });
});

// ---- DIKSHA ---------------------------------------------------------------------
export const dikshaRouter = Router();
dikshaRouter.use(requireAuth);

dikshaRouter.get('/status', (_req, res) => {
  const a = getDikshaAdapter();
  res.json({ diksha: { mode: a.mode, label: a.label, attribution: a.attribution(), live: a.mode === 'live' } });
});

dikshaRouter.get('/search', async (req, res) => {
  const result = await getDikshaAdapter().search({
    query: queryString(req, 'q'),
    subject: queryString(req, 'subject'),
    grade: queryString(req, 'grade'),
    medium: queryString(req, 'medium'),
    limit: Math.min(Number(queryString(req, 'limit') ?? 20) || 20, 50),
  });
  res.json(result);
});

dikshaRouter.get('/resources/:id', async (req, res) => {
  const resource = await getDikshaAdapter().getResource(paramString(req, 'id'));
  if (!resource) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'DIKSHA resource not found' } });
  if (req.session!.role === 'student') logActivity(req.session!.sub, 'diksha_open', resource.identifier);
  res.json({ resource });
});

// ---- i18n ------------------------------------------------------------------------
export const i18nRouter = Router();
i18nRouter.get('/languages', (_req, res) => {
  const t = getTranslationProvider();
  res.json({ languages: languageCatalogue(), translationProvider: { id: t.id, label: t.label, live: t.live }, speechProviders: speechProviders() });
});

// ---- Admin / system ----------------------------------------------------------------
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get('/stats', (_req, res) => res.json({ stats: adminStats(), system: systemStatus() }));

adminRouter.post('/reseed', (req, res) => {
  if (config.isProd && !config.demoMode) throw forbidden('Re-seeding is disabled in production');
  const out = seed({ force: true, quiet: true });
  res.json({ ...out, reseededBy: req.session!.sub });
});

export function systemStatus() {
  const exec = executionStatus();
  const diksha = getDikshaAdapter();
  return {
    version: config.version,
    environment: config.isProd ? 'production' : 'development',
    demoMode: config.demoMode,
    database: { driver: 'node:sqlite', path: config.databasePath === ':memory:' ? ':memory:' : 'file' },
    ai: providerStatus(),
    diksha: { mode: diksha.mode, label: diksha.label },
    execution: { serverRunner: exec.serverRunner, simulated: exec.simulated, browserLanguages: exec.browserLanguages, serverLanguages: exec.serverLanguages },
    pdfFonts: pdfFontSupport(),
    jwtSecretGenerated: config.jwtSecretGenerated,
  };
}

// ---- Health ------------------------------------------------------------------------
export const healthRouter = Router();
healthRouter.get('/', (_req, res) => {
  let db = 'ok';
  try {
    q.get('SELECT 1');
  } catch {
    db = 'error';
  }
  res.status(db === 'ok' ? 200 : 503).json({ status: db === 'ok' ? 'ok' : 'degraded', version: config.version, db, uptimeSec: Math.round(process.uptime()), time: nowIso() });
});
