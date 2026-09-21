# AIESES — Architecture Summary

```
┌──────────────────────────── Browser (React 19 SPA) ─────────────────────────────┐
│  Student / Teacher / Admin route trees · TanStack Query · i18n (en/hi/ta, unr pilot)│
│  CodeMirror IDE ─► Web Worker sandboxes (JS runner · Pyodide/WASM Python runner)  │
│  Markdown/rich-text editor · Tutor panel · SVG analytics                          │
└───────────────┬─────────────────────────────────────────────────────────────────┘
                │ same-origin /api (JWT httpOnly cookie, Origin check, rate limits)
┌───────────────▼──────────── Node 22 · Express 5 (one process) ──────────────────┐
│ routes/      auth · users · learning · assessments · classroom · workspace ·     │
│              ai · executions · diksha · admin · health · i18n                    │
│ services/    content · assessment · progress · adaptive (EduAdapt MVP) ·         │
│              analytics · pdf (pdfkit + Noto fonts) · i18n · diksha · execution   │
│ services/ai  tutor orchestrator · safety · providers { Demo | OpenAI-compatible }│
│ db/          node:sqlite · migrations (30 tables) · deterministic seed           │
│ static       client/dist (SPA fallback) · worker-scoped CSP                      │
└───────────────┬─────────────────────────────────────────────────────────────────┘
                │
        SQLite file (WAL) on a persistent disk   ·   optional external adapters:
        OpenAI-compatible LLM · Sunbird/DIKSHA search · Piston sandbox (all opt-in, env-driven)
```

## Key design decisions
| Decision | Why |
|---|---|
| Single deployable (API + SPA + SQLite) | Free-tier friendly, zero external services, cold-start seeds itself |
| `node:sqlite` instead of an ORM/native driver | No native compilation, deterministic tests with `:memory:`, trivial migrations |
| `shared/types.ts` as the API contract | Client and server compile against the same shapes |
| Provider interfaces (`AIProvider`, `DikshaAdapter`, `ExecutionAdapter`, `TranslationProvider`, `SpeechProvider`) | Demo/mocked implementations today, live implementations by env var — with honest labels in the UI |
| Code execution never on the server process | JS/Python in browser workers with timeouts; C/Java simulated & labelled; static deny-list screen; optional remote sandbox |
| Deterministic EduAdapt baseline | Explainable, testable, no model dependency; can be swapped for a learned model behind the same `Recommendation` shape |
| Error envelope + zod everywhere | Consistent `{ error: { code, message, details } }` for the UI's error states |

## Data model (30 tables)
`users` (role) → `student_profiles` / `teacher_profiles`; `classes` ⇄ `class_students`; curriculum `subjects → courses → modules → lessons (+ lesson_translations, lesson_skills)`, `skills`, `learning_resources`, `questions`, `assessments ⇄ assessment_questions`; learning state `attempts`, `progress`, `student_skills` (mastery), `recommendations`, `activity_log`; classroom `assignments`, `submissions`; workspace `projects → documents / files`, `code_executions`; AI `ai_conversations → ai_messages`; `schema_migrations`.

## Request flow — "submit practice"
`POST /api/assessments/:id/submit` → zod validate → `assessment.submitAttempt()` (score, feedback, points, lesson completion, assignment submission) → `adaptive.recordSkillEvidence()` (mastery update per skill) → `adaptive.regenerateRecommendations()` → response `{ attempt, weakSkills, recommendations }` → UI result page → `GET /api/recommendations/me` and `GET /api/progress/me` reflect it immediately.

## Repository layout
```
client/   Vite + React + Tailwind v4 (src/pages/{student,teacher,admin}, components, lib, workers)
server/   Express API (src/{routes,services,db,lib,middleware}, test/, scripts/)
shared/   TypeScript domain types shared by both
scripts/  smoke.mjs — end-to-end API journey
docs/     WORKSTREAMS · SECURITY · DEPLOYMENT · DEMO_SCRIPT · ARCHITECTURE
Dockerfile · render.yaml · railway.json · fly.toml · Procfile · .env.example
```
