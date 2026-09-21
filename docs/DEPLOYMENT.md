# AIESES — Deployment Guide

**Current status: READY TO DEPLOY — not deployed. BLOCKED — CREDENTIAL/ACCESS REQUIRED**
(no Render / Railway / Fly.io / container-registry credentials were available to the build environment, and Docker was not installed to test the image).

What *was* verified locally on 2026-09-21:
- `npm run build` → client bundle (`client/dist`) + server bundle (`server/dist/index.js`, 294 KB).
- `NODE_ENV=production JWT_SECRET=… DATABASE_PATH=/tmp/prodtest/prod.sqlite node server/dist/index.js` → cold boot ran migrations + seed, served the SPA (`GET /teacher` → 200) and the API; `BASE_URL=http://localhost:4100 npm run smoke` → **33/33 passed**.

## Runtime model
One Node.js ≥ 22.13 process serves everything: REST API under `/api`, the React SPA (static files + history fallback), and the SQLite database via the built-in `node:sqlite` module (no native add-ons, no external DB service needed for the MVP). Persist the SQLite file on a disk/volume; otherwise data resets on redeploy (demo mode re-seeds automatically, so an ephemeral disk is acceptable for a pure demo).

## Environment variables
| Variable | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | prod | `development` | `production` enables secure defaults & hides stack traces |
| `PORT` | no | `4000` | platform-injected on Render/Railway/Fly |
| `JWT_SECRET` | **yes (prod)** | random per boot | 48+ random bytes; missing ⇒ sessions reset on every restart |
| `DATABASE_PATH` | no | `./data/aieses.sqlite` | point to the mounted disk, e.g. `/var/data/aieses.sqlite` |
| `COOKIE_SECURE` | prod | `false` | `true` behind HTTPS |
| `TRUST_PROXY` | prod | `false` | `true` behind Render/Fly/Railway proxies |
| `ALLOWED_ORIGINS` | no | — | comma-separated extra browser origins (split deployments only) |
| `DEMO_MODE` | no | `true` | one-click demo logins + auto seed |
| `RESET_DB_ON_BOOT` | no | `false` | wipe & reseed on each boot (ephemeral demo hosting) |
| `AI_PROVIDER` | no | `demo` | `demo` or `openai-compatible` |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` / `AI_TIMEOUT_MS` | only for live AI | — | any OpenAI-compatible endpoint |
| `DIKSHA_MODE` / `DIKSHA_BASE_URL` | no | `mock` | `live` calls the public Sunbird search API (unverified) |
| `EXEC_PROVIDER` / `PISTON_BASE_URL` / `EXEC_TIMEOUT_MS` | no | `simulated` | `piston` for a remote sandbox |

## Health check
`GET /api/health` → `200 {"status":"ok","version":"0.1.0","db":"ok","uptimeSec":…}` (503 when the DB probe fails). Configured in `render.yaml`, `railway.json`, `fly.toml`, and the Docker `HEALTHCHECK`.

## Option A — Render (free tier, blueprint)
1. Push this repo to GitHub.
2. Render dashboard → **New → Blueprint** → select the repo. `render.yaml` provisions a free web service, a 1 GB disk mounted at `/var/data`, and auto-generates `JWT_SECRET`.
3. First deploy runs `npm ci && npm run build`, starts `npm start`; the app seeds itself on first boot.
4. Open `https://<service>.onrender.com` → demo logins are on the login page.

## Option B — Railway
`railway up` (or connect the repo). `railway.json` sets build/start/health-check. Add a volume mounted at `/data` and set `DATABASE_PATH=/data/aieses.sqlite`, `JWT_SECRET`, `TRUST_PROXY=true`, `COOKIE_SECURE=true`.

## Option C — Fly.io (Docker)
```bash
fly launch --copy-config --no-deploy
fly volumes create aieses_data --size 1 --region sin
fly secrets set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
fly deploy
```

## Option D — Any Docker host
```bash
docker build -t aieses .
docker run -p 4000:4000 -v aieses_data:/data -e JWT_SECRET=change-me aieses
```
The image is multi-stage (build → slim runtime), runs as the non-root `node` user, exposes `4000`, mounts `/data`, and includes a health check. **The image build was not executed in this environment (Docker unavailable) → `[NOT_VERIFIED]`.**

## Post-deploy verification
```bash
BASE_URL=https://<your-host> npm run smoke      # 33 end-to-end checks, exits non-zero on failure
```

## Seeding & reset
- Automatic on first boot (`ensureSeeded`).
- Manual: `npm run seed -- --force` (CLI) or **Admin → Reseed demo data** in the UI (`POST /api/admin/reseed {"confirm":"RESEED"}`).
