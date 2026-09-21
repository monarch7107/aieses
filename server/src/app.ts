import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { migrate } from './db/index.js';
import { ensureSeeded } from './db/seed.js';
import { attachSession, originCheck } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { learningRouter } from './routes/learning.js';
import { assessmentsRouter } from './routes/assessments.js';
import { classroomRouter } from './routes/classroom.js';
import { workspaceRouter } from './routes/workspace.js';
import { adminRouter, aiRouter, dikshaRouter, executionsRouter, healthRouter, i18nRouter } from './routes/misc.js';

export interface CreateAppOptions {
  seedDemo?: boolean;
  serveClient?: boolean;
}

export function createApp(opts: CreateAppOptions = {}): express.Express {
  migrate();
  if (opts.seedDemo ?? config.demoMode) ensureSeeded();

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          // Pyodide (Python-in-browser) is loaded from jsDelivr and needs WASM evaluation.
          'script-src': ["'self'", 'https://cdn.jsdelivr.net', "'wasm-unsafe-eval'"],
          'worker-src': ["'self'", 'blob:'],
          'connect-src': ["'self'", 'https://cdn.jsdelivr.net'],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'", 'data:'],
          'frame-ancestors': ["'self'", 'https://*.e2b.app', 'https://*.arena.ai'],
          'object-src': ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '512kb' }));
  app.use(cookieParser());
  app.use(attachSession);

  const api = express.Router();
  api.use(originCheck);
  api.use('/health', healthRouter);
  api.use('/auth', authRouter);
  api.use('/i18n', i18nRouter); // public — must be mounted before the auth-guarded root routers
  api.use('/users', usersRouter);
  api.use('/', learningRouter);
  api.use('/', assessmentsRouter);
  api.use('/', classroomRouter);
  api.use('/', workspaceRouter);
  api.use('/ai', aiRouter);
  api.use('/executions', executionsRouter);
  api.use('/diksha', dikshaRouter);
  api.use('/admin', adminRouter);
  api.use(notFoundHandler);
  app.use('/api', api);

  if (opts.serveClient ?? true) {
    const dist = config.clientDist;
    const indexFile = path.join(dist, 'index.html');
    if (fs.existsSync(indexFile)) {
      app.use(
        express.static(dist, {
          index: false,
          maxAge: '1h',
          setHeaders: (res, file) => {
            if (file.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            // Sandbox worker scripts (JS runner uses `new Function`, Pyodide needs WASM + eval) get their own,
            // worker-scoped CSP. A dedicated worker's policy comes from its script response, so this does NOT
            // loosen the document CSP — the page itself still forbids eval.
            if (/\/assets\/[^/]*worker[^/]*\.js$/.test(file)) {
              res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-eval' 'wasm-unsafe-eval'; connect-src 'self' https://cdn.jsdelivr.net; worker-src 'none'");
            }
          },
        }),
      );
      app.get(/^(?!\/api).*/, (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexFile);
      });
    } else {
      app.get('/', (_req, res) => {
        res.type('text/plain').send('AIESES API is running. Client build not found — run `npm run build` or use the Vite dev server on port 5173.');
      });
    }
  }

  app.use(errorHandler);
  return app;
}
