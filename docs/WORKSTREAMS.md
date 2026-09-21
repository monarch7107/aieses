# AIESES — Workstream Outputs (Orchestrated Build)

Internal hackathon build of the AIESES MVP (SIH PS 26207 · AICTE · Smart Education).
Forty specialist workstreams were executed as parallel slices and merged centrally by the
orchestrator into ONE coherent vertical slice: **Learn → Practice → Create → Build → Submit**.

Evidence tags used throughout: `[IMPLEMENTED]` `[TESTED]` `[SIMULATED]` `[MOCK]` `[BLOCKED]` `[NOT_VERIFIED]`.
Nothing is tagged `[TESTED]` unless the test/command was actually executed in this session.

Test evidence (executed 2026-09-21 in the build sandbox):

| Suite | Command | Result |
|---|---|---|
| Server integration tests (vitest + supertest, in-memory SQLite) | `npm test` | **60 passed / 60** (7 files) |
| End-to-end API smoke journey against running server | `npm run smoke` | **33 passed / 0 failed** |
| Same smoke journey against the **production bundle** (`NODE_ENV=production node server/dist/index.js`) | `BASE_URL=http://localhost:4100 npm run smoke` | **33 passed / 0 failed** |
| Type check server + client | `npm run typecheck` | 0 errors |
| Production build (Vite + esbuild) | `npm run build` | success (client 1.3 MB, server bundle 294 KB) |
| Browser UI click-through | — | `[NOT_VERIFIED]` no browser binary available in the build sandbox (Playwright/Chromium download blocked). UI verified only via typecheck + production build + served-SPA HTTP checks. |

---

## Group A — Product & System

### Agent 01 — Product Owner / Requirements
- **Output:** scope frozen to the demo vertical slice; P0/P1/P2 priorities applied (P2 collaboration/offline explicitly deferred).
- **Files:** `README.md`, `docs/DEMO_SCRIPT.md`.
- **Handoff:** acceptance = the 5-minute click-by-click flow in `docs/DEMO_SCRIPT.md`.

### Agent 02 — System Architect
- **Output:** monorepo (`client` Vite/React 19 + `server` Express 5 + `shared` types); single Node process serves API + SPA; `node:sqlite` (zero native deps); provider abstractions for AI, DIKSHA, execution, translation, speech. `[IMPLEMENTED]`
- **Files:** `docs/ARCHITECTURE.md`, `server/src/app.ts`, `server/src/config.ts`, `shared/types.ts` (437 lines, single source of truth for API shapes).

### Agent 03 — Database & Schema
- **Output:** 30 tables via idempotent migrations: users, student_profiles, teacher_profiles, classes, class_students, subjects, courses, modules, lessons, lesson_translations, skills, lesson_skills, learning_resources, questions, assessments, assessment_questions, attempts, progress, student_skills, recommendations, assignments, submissions, projects, documents, files, ai_conversations, ai_messages, code_executions, activity_log, schema_migrations. Foreign keys ON, WAL mode, cascade deletes. `[IMPLEMENTED]` `[TESTED]` (all suites run on it)
- **Files:** `server/src/db/schema.ts`, `server/src/db/index.ts` (typed `q.get/all/run/count`, `tx`).

### Agent 04 — Seed & Demo Data
- **Output:** deterministic seed (`seed({force})`, `ensureSeeded()`, CLI `npm run seed -- --force`, admin `POST /api/admin/reseed`): 3 subjects, 4 courses, 19 lessons, 62 questions, 18 resources, 19 skills, 6 lesson translations (hi/ta), 16 users, 2 classes, 3 assignments, 75 historical attempts with realistic mastery spread (on-track / needs-support / inactive students). `[IMPLEMENTED]` `[TESTED]`
- **Files:** `server/src/db/seed.ts`, `server/src/db/seed-content.ts`, `server/src/db/seed-cli.ts`.
- **Demo accounts:** `student@demo.aieses`, `teacher@demo.aieses`, `admin@demo.aieses`, second teacher `rahul.verma@demo.aieses` — all `Demo@1234`.

### Agent 05 — API Contract & Errors
- **Output:** REST under `/api` with zod validation; uniform envelope `{ error: { code, message, details? } }` with codes `VALIDATION_ERROR | BAD_REQUEST | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | PAYLOAD_TOO_LARGE | INTERNAL`. `[TESTED]` (`auth.test.ts`, `assessment.test.ts`, `workspace.test.ts`)
- **Files:** `server/src/lib/errors.ts`, `server/src/lib/http.ts`, `server/src/middleware/errorHandler.ts`.

## Group B — Frontend

### Agent 06 — Frontend Lead / Routing & State
- **Output:** React 19 + react-router 7 + TanStack Query; role-gated route trees (`/`, `/teacher`, `/admin`); auth context from `GET /api/auth/me`; code-split editors. `[IMPLEMENTED]` build OK; browser run `[NOT_VERIFIED]`.
- **Files:** `client/src/App.tsx`, `client/src/main.tsx`, `client/src/lib/{api,auth}.tsx`, `client/vite.config.ts` (dev proxy `/api → :4000`, `allowedHosts: true`).

### Agent 07 — Student Experience
- **Output:** Dashboard (stats, continue-learning, adaptive next step, weak areas, assignments, activity), Subjects, Course, Lesson (translation banner, key points, read-aloud, embedded tutor, practice CTA), Assessment (timer, MCQ/short answers, sticky submit), Result (score ring, skill breakdown, weak-area → recommendations, question review), Progress, Recommendations, Assignments (submit project), Resources, Tutor, Vernacular Classroom. `[IMPLEMENTED]`
- **Files:** `client/src/pages/student/*.tsx` (14 pages).

### Agent 08 — Teacher Experience
- **Output:** Teacher dashboard (totals, per-class weak areas, recent submissions), Classes, Class page (sortable roster with risk status, weak areas per student, skill heatmap, score distribution, assignments), Student detail, Assignments (create: existing quiz / generated-from-skills / project; detail with roster + grading modal showing submitted project docs & files), Analytics, Library (lesson preview + answer keys). `[IMPLEMENTED]`
- **Files:** `client/src/pages/teacher/*.tsx`.

### Agent 09 — Design System & Accessibility
- **Output:** Tailwind v4 tokens, reusable primitives (Button, Card, Badge, ProgressBar, MasteryBar, Input/Select/Textarea, Tabs, Modal, Spinner, Skeleton, EmptyState, Alert, ErrorState, StatCard, Avatar, PageHeader, Toast), SVG charts without a chart library, focus-visible rings, skip-link, aria roles on radio groups/progress bars/dialogs, reduced-motion support. Loading / empty / error states on every data view. `[IMPLEMENTED]`
- **Files:** `client/src/components/ui/index.tsx`, `client/src/components/charts/index.tsx`, `client/src/index.css`.

### Agent 10 — App Shell / Navigation / Responsive
- **Output:** responsive sidebar (drawer on mobile), sticky header with language selector + demo badge + pilot-language banner, role-specific nav. `[IMPLEMENTED]`
- **Files:** `client/src/components/layout/AppShell.tsx`.

## Group C — Core Platform

### Agent 11 — Auth & RBAC
- **Output:** bcrypt passwords, JWT in httpOnly SameSite=Lax cookie (Bearer also accepted), `requireAuth`/`requireRole`, demo one-click login (DEMO_MODE), registration limited to student/teacher, rate limits on auth, origin check for state-changing requests. `[TESTED]` (`auth.test.ts` 8/8, `teacher.test.ts` authorization block 6/6)
- **Files:** `server/src/routes/auth.ts`, `server/src/lib/auth.ts`, `server/src/middleware/auth.ts`.

### Agent 12 — Curriculum & Content Service
- **Output:** subjects/courses/modules/lessons/resources queries with per-student progress, prev/next lesson, practice assessment link, translations. `[TESTED]` (`learning.test.ts` 9/9)
- **Files:** `server/src/services/content.ts`, `server/src/routes/learning.ts`.

### Agent 13 — Assessment Engine
- **Output:** student view strips answer keys; deterministic scoring (MCQ index / short-answer accept list), per-question feedback, skill breakdown, points (score×10, +20 bonus ≥80%), lesson auto-complete ≥60%, auto-recorded assignment submission; teacher-generated assessments from skills. `[TESTED]` (`assessment.test.ts` 7/7)
- **Files:** `server/src/services/assessment.ts`, `server/src/routes/assessments.ts`.

### Agent 14 — Progress & Gamification
- **Output:** lesson progress, points, streaks from activity log, 14-day activity series, weekly minutes, recent attempts. `[TESTED]`
- **Files:** `server/src/services/progress.ts`.

### Agent 15 — EduAdapt Adaptive Engine ("Adaptive Recommendation MVP")
- **Output:** deterministic mastery model (first evidence `50 + (e−50)·0.6`, then EMA α=0.35), levels weak <60 / developing / strong ≥80, adaptive assessment level note, recommendation generator per weak skill (review lesson → practice set → resource) + "continue" item, labelled `source: eduadapt-mvp`. Recomputation is idempotent. `[TESTED]` (determinism, targets exist, sorting by priority)
- **Files:** `server/src/services/adaptive.ts`.

### Agent 16 — Classroom, Assignments & Submissions
- **Output:** classes, roster, assignments (assessment/project), submissions with grading, ownership checks (teacher ↔ class ↔ student). `[TESTED]` (`teacher.test.ts`, `workspace.test.ts`)
- **Files:** `server/src/routes/classroom.ts`, `server/src/services/analytics.ts`.

### Agent 17 — Teacher Analytics
- **Output:** class analytics (summary, risk segmentation, skill heatmap, weak areas, score distribution, activity), teacher overview, student detail for teacher, admin stats. `[TESTED]` (`teacher.test.ts` 7/7)
- **Files:** `server/src/services/analytics.ts`.

### Agent 18 — Security Hardening
- **Output:** helmet CSP (no `unsafe-eval` on the document; worker scripts get a worker-scoped CSP), rate limiting, payload limits, input validation, sanitised rich text (server `sanitize-html`, client DOMPurify), no secrets in responses, prompt-injection guard, static code screen. Checklist in `docs/SECURITY.md`. `[TESTED]` partially (CSRF origin check, tampered JWT, XSS sanitisation, RBAC, code screen)
- **Files:** `server/src/app.ts`, `server/src/services/ai/safety.ts`, `server/src/services/execution/index.ts`.

### Agent 19 — Observability & Health
- **Output:** `GET /api/health` (db check + version), structured startup log of provider modes, admin system status panel. `[TESTED]`

## Group D — AI

### Agent 20 — AI Tutor UX
- **Output:** chat panel with quick intents (Explain / Simpler / Example / Practice / What next?), MCQ answer buttons for practice questions, recommendation chips, provider badge (Demo vs Live), read-aloud, per-lesson context. `[IMPLEMENTED]`
- **Files:** `client/src/components/tutor/TutorPanel.tsx`, `client/src/pages/student/TutorPage.tsx`.

### Agent 21 — AI Provider Abstraction
- **Output:** `AIProvider` interface; `DemoTutorProvider` (default, curriculum-grounded, offline, labelled) and `OpenAICompatibleProvider` (any OpenAI-compatible endpoint via `AI_BASE_URL/AI_API_KEY/AI_MODEL`, falls back to demo on failure). Live provider `[NOT_VERIFIED]` (no API key available). `[TESTED]` for demo path (`ai.test.ts` 8/8)
- **Files:** `server/src/services/ai/{provider,demoProvider,openaiProvider}.ts`.

### Agent 22 — Tutor Orchestration & Context
- **Output:** conversation persistence, intent routing (explain/simpler/example/practice/answer/recommend/general), lesson + mastery grounding, practice-question state machine (never leaks the key), language routing. `[TESTED]`
- **Files:** `server/src/services/ai/tutor.ts`.

### Agent 23 — AI Safety
- **Output:** input screen (prompt-injection, system-prompt extraction, unsafe topics), output redaction of provider prompt, `meta.safety` surfaced in UI. `[TESTED]`
- **Files:** `server/src/services/ai/safety.ts`.

### Agent 24 — Adaptive ↔ Tutor Integration
- **Output:** `recommend` intent returns live EduAdapt recommendations inside chat. `[TESTED]`

## Group E — Language

### Agent 25 — i18n Framework (UI)
- **Output:** `I18nProvider`, ~90 UI strings in **English, हिन्दी, தமிழ்**; language persisted to profile (`PATCH /api/users/me`); Mundari (`unr`) registered as pilot with English fallback banner. `[IMPLEMENTED]`
- **Files:** `client/src/lib/i18n.tsx`.

### Agent 26 — Content Translation Layer
- **Output:** `lesson_translations` table + `TranslationProvider` abstraction (dictionary of human-authored demo translations; **no machine translation is fabricated**). Sample lessons translated to hi + ta: *What is a Fraction?*, *Equivalent Fractions*, *Luminous & Non-luminous Objects*. Fallback status returned explicitly. `[TESTED]` (`learning.test.ts`)
- **Files:** `server/src/services/i18n.ts`, `server/src/db/seed-content.ts`, `GET /api/i18n/languages`.

### Agent 27 — Speech (read-aloud)
- **Output:** `SpeechProvider` interface; browser Web Speech implementation (en-IN/hi-IN/ta-IN voices when installed); external TTS stub documented as not connected. Browser behaviour `[NOT_VERIFIED]` in this sandbox.
- **Files:** `client/src/lib/speech.ts`.

### Agent 28 — Vernacular Classroom & Mundari Pilot
- **Output:** classroom page showing language catalogue, sample text, read-aloud, sample lesson links; Mundari pilot page states clearly that **no content is shipped** and describes the intake path. `[IMPLEMENTED]`
- **Files:** `client/src/pages/student/ClassroomPage.tsx`.

## Group F — Content & DIKSHA

### Agent 29 — Curriculum Authoring (Grade 6–8)
- **Output:** Maths (Fractions & Decimals — 7 lessons), Science (Light — 5 lessons), CS (Python — 5, JavaScript — 2), each lesson with markdown body, key points, tutor notes (simpler / example / misconceptions / glossary), skill tags, 3–5 practice questions with explanations, checkpoint quizzes. `[IMPLEMENTED]`
- **Files:** `server/src/db/seed-content.ts`.

### Agent 30 — DIKSHA Adapter
- **Output:** `DikshaAdapter` interface (`search`, `getResource`, `attribution`); `MockDikshaAdapter` (default, every item `isDemo: true`, `source: 'DIKSHA (DEMO DATA)'`); `LiveDikshaAdapter` for the public Sunbird composite-search API, opt-in via `DIKSHA_MODE=live`, falls back to mock with an explicit note. Live path `[NOT_VERIFIED]` (no outbound access). `[MOCK]` `[TESTED]` for mock.
- **Files:** `server/src/services/diksha.ts`, `client/src/pages/student/ResourcesPage.tsx`.

### Agent 31 — Learning Resources Library
- **Output:** 18 curated resources with type, language, attribution, skill mapping; recommended resources deep-link via `?highlight=`. `[IMPLEMENTED]`

## Group G — Creation Workspace

### Agent 32 — Projects & Files API
- **Output:** projects (document/code/mixed, starter templates, assignment link, submit), documents (markdown/text/richtext, server-side sanitisation), code files (name validation, size limits), owner-only access with teacher read via submissions. `[TESTED]` (`workspace.test.ts` 9/9)
- **Files:** `server/src/routes/workspace.ts`.

### Agent 33 — Document Editor
- **Output:** markdown editor with toolbar + live preview (edit/split/preview), rich-text (contentEditable) and plain-text modes, autosave (2 s) + Ctrl/Cmd+S, word count, document language selector, PDF export button. `[IMPLEMENTED]`
- **Files:** `client/src/pages/student/DocumentEditorPage.tsx`, `client/src/lib/markdown.tsx`.

### Agent 34 — PDF Export
- **Output:** pdfkit renderer for markdown/rich text/plain text (headings, lists, quotes, tables, code blocks, footer with page numbers) with **embedded Noto Sans Devanagari + Tamil** fonts (script-aware font switching). `[TESTED]` (Hindi + Tamil document exported: valid `%PDF-`, fonts embedded — `workspace.test.ts`, curl check 11 KB)
- **Files:** `server/src/services/pdf.ts`.

### Agent 35 — Code IDE UI
- **Output:** CodeMirror 6 editor (JS/Python/C/Java syntax), file explorer per project, language selector, run/stop, console with status/duration/runner badge, run history, scratchpad mode, autosave. `[IMPLEMENTED]`
- **Files:** `client/src/pages/student/IdePage.tsx`.

### Agent 36 — Code Execution & Sandboxing
- **Output:** JavaScript runs in a **dedicated Web Worker** (dangerous globals shadowed, 5 s hard timeout → worker terminated, output cap); Python via **Pyodide (WebAssembly) in a worker** (CDN-loaded; falls back to the simulated runner when offline); C/Java via server-side **`SimulatedRunner`** labelled *"Sandbox execution demo"* (no compilation or execution on the host — echoes print statements, `<value>` for expressions); static deny-list screen (process control, networking, file system, reflection, inline asm); optional Piston adapter `[NOT_VERIFIED]`. Server refuses to run browser languages. All runs recorded. `[SIMULATED]` for C/Java; `[TESTED]` (`execution.test.ts` 6/6); browser workers `[NOT_VERIFIED]` in this sandbox (no browser; Pyodide CDN unreachable from sandbox).
- **Files:** `server/src/services/execution/index.ts`, `client/src/lib/runner.ts`, `client/src/workers/*.worker.ts`.

## Group H — Platform Engineering

### Agent 37 — Testing & QA
- **Output:** 60 integration tests across auth, courses, lessons, assessment submit/score, progress, adaptive recommendations, AI endpoint, document save, PDF export, project creation, teacher analytics, authorization, execution safety; end-to-end smoke script. Results above. `[TESTED]`
- **Files:** `server/test/*.test.ts`, `server/vitest.config.ts`, `scripts/smoke.mjs`.

### Agent 38 — Build & Tooling
- **Output:** npm workspaces, `npm run dev` (concurrently), `npm run build` (Vite + esbuild bundle), `npm start`, `npm run typecheck`, `npm test`, `npm run smoke`, `npm run seed`. `[TESTED]`

### Agent 39 — Deployment
- **Output:** `Dockerfile` (multi-stage, non-root, healthcheck, `/data` volume), `render.yaml` (free plan + 1 GB disk), `railway.json`, `fly.toml`, `Procfile`, `.env.example`. Production bundle boot verified locally (cold start auto-migrates + seeds, SPA served, 33/33 smoke). **Deployment status: BLOCKED — CREDENTIAL/ACCESS REQUIRED** (no Render/Railway/Fly credentials in this environment; Docker not available to test the image). `[NOT_VERIFIED]` for the container image.
- **Files:** see `docs/DEPLOYMENT.md`.

### Agent 40 — Documentation & Demo
- **Output:** `README.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md`, `docs/DEMO_SCRIPT.md`, this file.

---

## Cross-cutting blockers & known limitations
1. **No browser in the sandbox** → UI was type-checked and built but not clicked through by the orchestrator. Highest-value next step is a browser QA pass of the demo script (or Playwright e2e once a browser is available).
2. **Pyodide CDN / external AI / live DIKSHA** unreachable from the sandbox → those paths ship with explicit fallbacks and labels; not verified live.
3. **C/Java execution is simulated** by design (no compiler on the app server). Real isolation requires the Piston adapter or a container-based runner.
4. **Mundari:** architecture only, zero content (by instruction — nothing fabricated).
5. **Deployment:** ready, not deployed (credentials required).
