# AIESES — 5-Minute Demo Script (click-by-click)

Start the app (`npm run dev` → http://localhost:5173, or `npm run build && npm start` → http://localhost:4000).
All accounts use password **`Demo@1234`**; the login page also has one-click demo buttons.

> ⚠️ Honesty note: this flow was verified end-to-end at the **API level** (`npm run smoke`, 33/33) and the UI was type-checked and production-built; the click path itself was **not** executed in a browser by the build orchestrator (no browser available in the build sandbox).

## Part 1 — Student (≈3 min) · `student@demo.aieses`
| # | Click | What you should see |
|---|---|---|
| 1 | Login page → **Student** demo button | Redirect to **Dashboard**: points, streak, lessons completed (3/19 on a fresh seed), "Next best step" card from *Adaptive Recommendation MVP*, weak-area chips, pending assignments, 14-day activity chart |
| 2 | Sidebar **Subjects** → **Mathematics** → **Fractions & Decimals** | Course page with 2 modules, 7 lessons, per-lesson progress |
| 3 | Open **Equivalent Fractions** | Lesson page: markdown body, key points, prev/next, **"Ask AI Tutor"** panel on the right |
| 4 | Header language selector → **हिन्दी** | UI switches to Hindi; lesson banner shows the human-authored Hindi translation *तुल्य भिन्न* (switch back to English or stay) |
| 5 | Tutor panel → **Explain** → **Simpler** → **Practice** | Context-aware answers tagged *Demo Tutor*; practice returns an MCQ with answer buttons — answer it, get graded feedback |
| 6 | Lesson → **Practice this lesson** | Assessment page: 5 questions, timer, adaptive level note (*"Your mastery on these skills is 58%…"*) |
| 7 | Answer (get a few wrong on purpose) → **Submit** | Result page: score ring, points earned, per-skill breakdown, **Weak area: Equivalent Fractions**, question-by-question review |
| 8 | **View recommendations** | Adaptive Recommendation MVP list: *Review lesson*, *Practice set*, *Resource*, with reasons — click one to open the recommended lesson/practice/resource |
| 9 | Sidebar **Workspace** → **New project** ("Shadows lab report", *Mixed*, starter *Markdown*) | Project page with a document and a code file scaffolded |
| 10 | Open the document → type markdown (try Hindi/Tamil text) → autosave / **Ctrl+S** → **Export PDF** | PDF downloads with embedded Devanagari/Tamil fonts |
| 11 | Back → open **main.js** in **Code** tab → **Run** | Runs in the browser Web Worker sandbox; console shows output, duration, runner badge. Switch language to **C** → **Run** → labelled **"Sandbox execution demo (simulated)"** output |
| 12 | Project page → **Submit to assignment** → *Light & Shadows project* | Project status → *Submitted* |
| 13 | Sidebar **Dashboard** | Points/progress updated, recent attempt visible, weak area & next step refreshed |

## Part 2 — Teacher (≈1.5 min) · `teacher@demo.aieses`
| # | Click | What you should see |
|---|---|---|
| 1 | Logout → **Teacher** demo button | Teacher dashboard: 8 students, 4 at risk, pending grading, per-class weak areas |
| 2 | **Class 6A — Maths & Science** | Roster with status (on track / needs support / inactive), avg 48 %, skill heatmap, score distribution, weak areas (Shadows, Fraction↔Decimal, …) |
| 3 | Click **Rohan** | Student detail: mastery per skill, attempt history, risk status |
| 4 | **Assignments → New assignment** → *Generate from skills* (Equivalent Fractions, 2 per skill) → create | New assessment assigned to the class |
| 5 | Assignments → **Light & Shadows project** | The student's submission from Part 1 appears → **Grade** (90, feedback) → status *graded* |
| 6 | **Analytics** | Cross-class analytics: activity, distributions, weak-skill ranking |

## Part 3 — Admin (≈30 s) · `admin@demo.aieses`
| # | Click | What you should see |
|---|---|---|
| 1 | Logout → **Admin** demo button | Stats: 16 users, 19 lessons, 62 questions, provider modes (AI = Demo, DIKSHA = mock, exec = simulated), health |
| 2 | **Users** → change a role | Role updated via `PATCH /api/users/:id/role` |
| 3 | **Reseed demo data** | Database reset to the deterministic demo state |

## Talking points
- "Adaptive Recommendation MVP" = deterministic EduAdapt baseline (mastery EMA → weak skills → lesson/practice/resource), fully explainable.
- AI Tutor is provider-agnostic; today it runs the offline **Demo Tutor** grounded in the lesson content — set `AI_PROVIDER=openai-compatible` for a live model, same UI.
- Languages: English/Hindi/Tamil UI + sample content; Mundari is a registered pilot with **no fabricated content**.
- DIKSHA panel is a clearly labelled **DEMO DATA** adapter; the live Sunbird search adapter is one env var away (unverified).
- No student code ever runs on the server: JS/Python in browser workers, C/Java simulated & labelled.
