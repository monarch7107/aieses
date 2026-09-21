# AIESES — Security Checklist (MVP)

Status legend: ✅ implemented & covered by an executed test · ☑️ implemented (manual/curl check only) · ⚠️ partial / documented gap · ❌ not done.

## Authentication & sessions
| Item | Status | Where |
|---|---|---|
| Passwords hashed with bcrypt (cost 10), never returned by any endpoint | ✅ `auth.test.ts` | `server/src/lib/auth.ts`, `routes/auth.ts` |
| JWT (HS256, 7 d) stored in `httpOnly`, `SameSite=Lax` cookie; `Secure` when `COOKIE_SECURE=true` | ✅ | `lib/auth.ts` |
| Tampered / expired tokens rejected with `401 UNAUTHORIZED` | ✅ `teacher.test.ts` | `middleware/auth.ts` |
| `JWT_SECRET` from env; if unset a random per-process secret is generated with a loud startup warning (sessions reset on restart) — set it in production (`render.yaml` auto-generates it) | ☑️ | `config.ts`, `index.ts` |
| Registration restricted to `student` / `teacher`; admin accounts only via seed or admin role change | ✅ `auth.test.ts` | `routes/auth.ts` |
| Demo one-click login only when `DEMO_MODE=true` | ☑️ | `routes/auth.ts` |
| Rate limits per IP: auth 30 req/15 min, AI chat 120/15 min, code execution 30/min | ☑️ (skipped in tests) | `routes/auth.ts`, `routes/misc.ts` |

## Authorization (RBAC + ownership)
| Item | Status |
|---|---|
| `requireRole()` on every teacher/admin route; students receive `403 FORBIDDEN` on analytics, class, grading, admin endpoints | ✅ `teacher.test.ts` |
| Teachers can only read classes / students / submissions they own (`teacherOwnsClass`, class membership joins) | ✅ `teacher.test.ts` |
| Projects, documents, files, conversations are owner-scoped (`WHERE owner_id = ?`); cross-user access → `403` / `404` | ✅ `workspace.test.ts`, `ai.test.ts` |
| Assessment answer keys stripped from student responses; teacher preview includes keys | ✅ `assessment.test.ts` |
| Role changes admin-only; admin cannot demote themselves | ☑️ | `routes/users.ts` |

## Input validation & data handling
| Item | Status |
|---|---|
| Every mutating endpoint validated with zod → `400 VALIDATION_ERROR` with field-level `details` | ✅ |
| JSON body limit 512 KB; document content ≤ 200 KB; code file ≤ 100 KB; run payload ≤ 20 KB; run output capped at 10 KB | ☑️ |
| Rich-text sanitised server-side (`sanitize-html` allow-list) **and** client-side (DOMPurify) | ✅ `workspace.test.ts` (script tag removed) |
| Markdown rendered via `react-markdown` (no raw HTML) | ☑️ |
| File names restricted to `[A-Za-z0-9._-]`, no path traversal (nothing is written to disk) | ☑️ |
| SQLite prepared statements everywhere (no string-built SQL) | ☑️ |

## Web platform hardening
| Item | Status |
|---|---|
| `helmet` defaults + strict CSP (`default-src 'self'`; no `unsafe-eval` on documents; `connect-src` allows only self + Pyodide CDN; `frame-ancestors 'none'`) | ☑️ curl header check |
| Worker scripts served with a worker-scoped CSP (`script-src 'self' 'unsafe-eval' cdn.jsdelivr.net`) so the browser sandbox can load WASM/eval **inside the worker only** | ☑️ |
| CSRF: state-changing requests must carry an `Origin` matching the host (or an `ALLOWED_ORIGINS` entry); cookie is `SameSite=Lax` | ✅ `teacher.test.ts` |
| CORS only enabled for configured `ALLOWED_ORIGINS` (default: same-origin only) | ☑️ |
| `TRUST_PROXY` support for correct client IPs & secure cookies behind Render/Fly/Railway | ☑️ |
| No stack traces in production error responses | ☑️ |

## AI tutor
| Item | Status |
|---|---|
| Provider system prompt never leaves the server; `meta.provider` only exposes `demo` / `live` | ✅ `ai.test.ts` |
| Prompt-injection / system-prompt extraction requests blocked (`meta.safety.blocked`) | ✅ `ai.test.ts` |
| Provider output redaction (strips accidental prompt echo) | ☑️ |
| API keys only via env (`AI_API_KEY`), never in code or client bundle | ✅ (client bundle greps clean) |
| Message length limit 2 000 chars; per-conversation ownership enforced | ✅ |

## Code execution
| Item | Status |
|---|---|
| **No untrusted code is ever executed on the API server process.** JS/Python run in the *student's browser* inside dedicated Web Workers; C/Java use a labelled **simulated** runner | ✅ `execution.test.ts` (server rejects browser languages; simulated runner never spawns) |
| Worker isolation: dangerous globals shadowed (`fetch`, `XMLHttpRequest`, `importScripts`, `WebSocket`, `indexedDB`…), 5 s wall-clock timeout with `worker.terminate()`, output capped at 20 000 chars | ☑️ (browser `[NOT_VERIFIED]` in sandbox) |
| Static deny-list screen for C/Java/Python/JS (process control, sockets, file I/O, reflection, inline asm, empty infinite loops) → `status: blocked` | ✅ `execution.test.ts` |
| Optional remote sandbox (Piston) is opt-in, has request timeouts + memory limit, falls back to simulation with a note | ☑️ (not exercised) |
| Every run recorded in `code_executions` (language, runner, status) | ☑️ |

## Secrets & configuration
| Item | Status |
|---|---|
| No hard-coded production secrets; `.env` git-ignored; `.env.example` documents every variable | ✅ |
| Demo credentials are synthetic (`*@demo.aieses`, `Demo@1234`) and shown only when `DEMO_MODE=true` | ✅ |
| Health endpoint exposes only status/version/db, no config | ✅ |

## Known gaps (honest)
- ⚠️ No account lockout / email verification / password reset (out of MVP scope).
- ⚠️ No audit trail beyond `activity_log` and `code_executions`.
- ⚠️ CSP allows `'unsafe-inline'` for styles (Tailwind runtime) — acceptable for MVP.
- ⚠️ Browser-side sandbox properties (timeouts, global shadowing) were reviewed in code but not executed in a browser during this build.
- ⚠️ `npm audit` (executed): **0 vulnerabilities in production dependencies**; 2 moderate advisories in dev-only `@vitest/mocker` (test tooling, not shipped).
