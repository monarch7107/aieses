# AIESES — AI-Enabled Smart Education System

MVP for **SIH Problem Statement 26207 (AICTE · Smart Education)**: one integrated vertical slice
**Learn → Practice → Create → Build → Submit** for students, with a teacher classroom/analytics view and a minimal admin console.

| | |
|---|---|
| Stack | React 19 · Vite · Tailwind v4 · TanStack Query · CodeMirror 6 — Node 22 · Express 5 · `node:sqlite` · zod · pdfkit |
| Status | Builds, boots, **60/60 integration tests** and **33/33 end-to-end smoke checks** pass (2026-09-21). UI verified by typecheck + production build only (no browser in the build sandbox). Deployment: ready, not deployed — see `docs/DEPLOYMENT.md`. |
| Docs | [Workstreams & evidence](docs/WORKSTREAMS.md) · [Architecture](docs/ARCHITECTURE.md) · [Security checklist](docs/SECURITY.md) · [Deployment](docs/DEPLOYMENT.md) · [5-minute demo script](docs/DEMO_SCRIPT.md) |

## Quick start
```bash
npm install                 # Node >= 22.13 (uses the built-in node:sqlite)
npm run dev                 # API :4000 + Vite :5173 (proxy /api) — DB auto-created & seeded
# or production-style:
npm run build && npm start  # single process on :4000 serving API + SPA
```
Open http://localhost:5173 (dev) or http://localhost:4000 (prod build).

**Demo accounts** (password `Demo@1234`, or use the one-click buttons on the login page):
`student@demo.aieses` · `teacher@demo.aieses` · `admin@demo.aieses` (second teacher: `rahul.verma@demo.aieses`).

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | server (tsx watch) + client (Vite) concurrently |
| `npm run build` | `client/dist` (Vite) + `server/dist/index.js` (esbuild bundle) |
| `npm start` | run the production bundle |
| `npm test` | 60 vitest + supertest integration tests on an in-memory DB |
| `npm run smoke` | end-to-end API journey against a running server (`BASE_URL=…`) |
| `npm run typecheck` | `tsc --noEmit` for server and client |
| `npm run seed -- --force` | wipe & reseed the demo database |

## What's in the MVP
- **Learn:** subjects → courses → modules → lessons (Grade 6–8 Maths, Science, CS), key points, prev/next, read-aloud, Hindi/Tamil sample translations, DIKSHA resource panel (**DEMO DATA** adapter).
- **AI Tutor:** context-aware chat (explain / simpler / example / practice / what next), provider abstraction (offline **Demo Tutor** by default, any OpenAI-compatible API by env), safety filter, no system prompt exposure.
- **Practice & Assess:** practice sets per lesson, teacher-generated assessments from skills, deterministic scoring, per-question feedback, skill breakdown, points & streaks.
- **Adaptive Recommendation MVP (EduAdapt baseline):** mastery per skill → weak areas → review lesson / practice / resource recommendations with reasons.
- **Create & Build:** projects with markdown / rich-text / plain-text documents (autosave, PDF export with Devanagari & Tamil fonts) and a code IDE (JS & Python in browser Web-Worker sandboxes; C & Java via a labelled **Sandbox execution demo**; static safety screen).
- **Submit & Teach:** assignments, project submissions, grading; teacher dashboard with roster risk status, skill heatmaps, weak areas, analytics; admin stats, users/roles, reseed.
- **Multilingual:** UI in English / हिन्दी / தமிழ்; Mundari registered as a pilot language (architecture only — no fabricated content).

## Honest labels
`[SIMULATED]` C/Java execution · `[MOCK]` DIKSHA results · `[DEMO]` AI tutor provider · `[NOT_VERIFIED]` browser click-through, Pyodide CDN path, live AI/DIKSHA/Piston adapters, Docker image build · `[BLOCKED — CREDENTIAL/ACCESS REQUIRED]` hosted deployment.

## Environment
Everything runs with zero configuration in demo mode. See `.env.example` for `JWT_SECRET` (set in production), `DATABASE_PATH`, `AI_*`, `DIKSHA_MODE`, `EXEC_PROVIDER`, etc.

## License
Hackathon prototype — internal use.
