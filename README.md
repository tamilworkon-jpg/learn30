# Learn30 — 30-day courses, one hour a day

**Learn30** is a free, offline-friendly study platform: each course is a 30-day plan of one-hour lessons shown as screen-sized slides, with daily quizzes, module reviews, mock exams, a glossary and cheat sheets. A small Node server serves the site and keeps each learner's progress in a local SQLite file — one login = one learner, with **separate progress per course**, following you to any browser or device that signs in.

The home page (`/`) is the course catalogue; every course lives under `/course/<id>/…` (pre-Learn30 links such as `/day/02` redirect into the first course).

**Courses**

| Course | Code | Content |
|---|---|---|
| [AWS Certified AI Practitioner](specs/001-aws-ai-practitioner-course/) (`aws-ai-practitioner`) | AIF-C01, exam guide v1.2 | 24 lesson days · 4 module review days · 2 mock-exam days · 903 exam-style questions · 166 glossary terms · 75 service cards |

Adding a course = one registry entry in `site/src/data/courses.yaml` + one content folder ([`specs/002-learn30-platform/contracts/course-folder.md`](specs/002-learn30-platform/contracts/course-folder.md)).

| | |
|---|---|
| Stack | Astro 5 (static build) + MDX · Preact islands · Tailwind CSS v4 · build-time Mermaid SVG · Pagefind search · Node 22 server (`node:http` + built-in `node:sqlite`, no extra runtime dependencies) · Vitest · Playwright + axe |
| Specs | [`specs/002-learn30-platform/`](specs/002-learn30-platform/) — platform (courses, routes, per-course progress) · [`specs/001-aws-ai-practitioner-course/`](specs/001-aws-ai-practitioner-course/) — course #1 |

---

## 1. Prerequisites

- **Node.js 22** (≥ 22.12; 22.19+ avoids `undici` engine warnings) and npm 10. The server uses Node 22's built-in `node:sqlite`, so older Node versions cannot run it.
- **Windows + WSL note:** this checkout's `site/node_modules` was installed with **Windows** Node. If you work in a WSL shell, run npm through Windows so the native binaries match:
  ```bash
  cmd.exe /c "cd /d C:\LocalDrive\Learning\ai-practioner\site && npm run dev"
  ```
  (In PowerShell / Windows Terminal just `cd site` and run `npm …` directly.) If you prefer Linux Node inside WSL, delete `site/node_modules` and run `npm ci` there instead — don't mix the two.
- First time only, install the Playwright browser: `npx playwright install chromium`.

## 2. Install and run

```bash
cd site
npm ci                 # install exact dependency versions
npm run dev            # http://localhost:4321  (hot reload)
```

`npm run dev` is for editing pages and content; it has no accounts and does not save progress. To use the course (what learners actually run):

```bash
npm start              # build (validators + diagrams → astro build → Pagefind index in dist/), then start the server
npm run serve          # start the server on an existing dist/ (no rebuild)
```

Open http://localhost:4321, **Create account**, and start Day 1. Search only works on the built site (the index is generated at build time).

### Server settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4321` | HTTP port |
| `HOST` | `127.0.0.1` | Listen address: this computer only (VS Code port forwarding still works). Set `HOST=0.0.0.0` to let other devices on your LAN connect directly |
| `AIP_MAX_USERS` | `50` | Maximum number of accounts; sign-up is refused (with a message) once reached |
| `AIP_SIGNUPS_PER_HOUR` | `5` | Successful sign-ups allowed per IP address per hour (×4 for connections arriving through localhost / a tunnel) |
| `AIP_SCRYPT_N` | `131072` | scrypt cost for new password hashes (power of two, 16384–262144); 2^17 uses 128 MiB and about 1–2 s per sign-in on a laptop |
| `AIP_TRUST_PROXY` | off | `1` = when a request comes from localhost (a tunnel or reverse proxy), rate-limit by the address in the last `X-Forwarded-For` entry |
| `AIP_DB` | `site/data/aip.db` | SQLite database file (created with its schema on first start) |

Example: `PORT=8080 AIP_DB=/path/to/aip.db npm run serve` (Windows `cmd`: `set PORT=8080&& npm run serve`).

### Your data: the SQLite file

- All accounts, progress and UI preferences (lesson view, side bars, slide position) live in **`site/data/aip.db`** (or wherever `AIP_DB` points). `site/data/` is gitignored — your progress never ends up in a commit.
- **Backup:** stop the server, then copy the file (copy `aip.db-wal` / `aip.db-shm` too if they exist). Restore by copying it back while the server is stopped.
- **Reset everything:** stop the server and delete the file (and its `-wal`/`-shm` files); a fresh empty database is created on the next start.
- Per learner, **Settings → Export progress** still downloads a JSON copy, and **Import progress file** loads one.

### Use it on your phone / another device (port forwarding)

1. `npm start` (forwarding works with the default `HOST=127.0.0.1`; to open it by LAN IP instead, start with `HOST=0.0.0.0`).
2. VS Code → **Ports** panel → **Forward a Port** → `4321` → open the forwarded URL on the other device.
3. **Sign in** there with the same username and password: progress is stored on the server, so it is the same on every address and device (localhost, the forwarded URL, your LAN IP). Each address asks you to sign in once, because the browser keeps a separate login cookie per address.

## 3. Using the site

- **Accounts:** **Create account** (username, display name, password of 8+ characters) or **Sign in**; the avatar menu in the top-right shows who is signed in and has **Settings** and **Log out**. One login = one learner: each account has its own progress, start date, quiz attempts, theme and UI preferences. **Settings → Account** changes the display name or password and deletes the account (password required). The home page (`/`) is the **Courses** catalogue (the outer layer; this course is #1) and is public; the sidebar groups the course's own pages (Dashboard, Outline, Search, Glossary, Cheat sheets) under the course name, with account **Settings** below. The course dashboard (`/course/aws-ai-practitioner`), Settings and mock exams need you to be signed in; lessons, glossary, cheat sheets and search are readable signed out, where quizzes work but nothing is saved (a banner offers **Sign in to save your progress**).
- **Progress from the old browser-only version:** the first time you sign in on a browser that still holds progress saved by the earlier version of the site, it offers **Import progress saved in this browser** once.
- **Schedule:** weekdays only (Mon–Fri). Day 1 is the account's start date (or the Monday after, if it is a weekend) and each later day is the next weekday, so the 30 days make **6 weeks of 5 days**; the course's 5 topic groups are called **Modules** (Module 1 = Days 1–7, …, Module 5 = Days 29–30). The dashboard shows start, the **original finish**, an **updated finish** (the original moved by one weekday per day you are behind or ahead — recomputed whenever you open it), today's plan day and ahead/behind; "This week" lists the current Week's five days; the outline groups days by Week with dates. Weekends never break a streak. Change the start in **Settings → Your schedule**.
- **Lessons as slides:** each lesson section becomes screen-sized slides with big type, a visual on every slide and highlighted key terms. Navigate with the buttons, ←/→ keys or swipe; **Full page** switches back to the long view (used for printing and search).
- **Quizzes and mocks:** answers save as you go; results explain every option and link back to the lesson section. Mock exams are timed (90 min) with a palette, flags and a review screen; scores use the 100–1000 scale (pass 700).
- **Backup:** Settings → Export / Import (JSON, validated, ≤ 1 MB) and Reset (with confirmation) act on the signed-in learner; the whole database is backed up by copying the SQLite file (above).

## 4. Quality checks

All commands run from `site/`.

| Command | What it does |
|---|---|
| `npm run lint` | ESLint (bans `innerHTML`/`outerHTML`) |
| `npm run typecheck` | `astro check` (TypeScript + Astro) |
| `npm run validate:content` | Lesson structure, timing (50–70 min), question sets, coverage per task statement, glossary/service cards |
| `npx tsx scripts/validate-content.ts --final` | Release gate: also requires all 30 days, ≥ 900 unique questions, ≥ 3 questions per task statement |
| `npm run test` | Unit tests (Vitest), incl. the server (`tests/unit/server-*.test.ts`: in-process server, temp database) |
| `npm run test:sanity` | **Default browser check** (~30 s after the build): every page once, one screenshot per page (desktop), no console errors → `site/tests/e2e/__screenshots__/sanity/`. Builds into `dist-e2e/`, so it never disturbs a running `npm start` |
| `npm run test:e2e` | **Full suite — run only when you want "all"** (~9 min): all browser tests (Playwright: desktop 1280×800 + mobile 375×812). Builds the site and starts the real server with a fresh temporary database (`site/data/e2e/e2e-<port>-<run>.db`, older ones for the same port deleted at start); every test signs up its own random account |
| `npm run test:visual` | Only the `@visual` specs (screenshots in `tests/e2e/__screenshots__/`) |
| `npm run verify` | lint + typecheck + validate + unit + sanity |
| `npm run verify:all` | the same with the full e2e suite |
| `npm run audit:tasks` | Checks `tasks.md`: completed tasks have their test files and screenshots; lists unchecked tasks (`-- --final` fails on any) |
| `npx tsx scripts/perf-check.ts /day/02` | Gzipped JS shipped by a page (budget 200 KB) |

Useful variants:

```bash
npx playwright test quiz --reporter=line          # one spec
npx playwright test --grep-invert=T175            # everything except visual regression
npx playwright test visual --update-snapshots=all # re-baseline AFTER inspecting the new PNGs (plain --update-snapshots skips changes within the 1% tolerance)
E2E_PORT=4441 npx playwright test                 # run on another port (parallel checkouts/worktrees)
```

On Windows `cmd`, set the port with `set E2E_PORT=4441&& npx playwright test` (no space before `&&`).

E2E specs import `test`/`expect` from `tests/e2e/fixtures.ts`, never from `@playwright/test`: the fixture signs up a fresh account per test and saves the Full page lesson view for it. Options: `test.use({ signedIn: false })` for signed-out behaviour, `test.use({ lessonView: null })` for the default slide view. `seed(page, progress)` (`progress-fixtures.ts`) saves progress on the server (`PUT /api/progress`) and must run before the first `page.goto`; `readProgress(page)` waits for the page's debounced saves and reads it back. The server never reuses a running instance (`reuseExistingServer: false`) — stop stray servers on the port first.

## 5. Editing content

- **Lessons:** `site/src/content/lessons/day-NN.mdx`. Copy an existing lesson (e.g. `day-02.mdx`). Sections must keep the order recap → objectives → explanation → diagram → examples → real-world → hands-on → exam-tips → summary → quiz → deep-dive. Frontmatter is validated against [`contracts/lesson-frontmatter.schema.json`](specs/001-aws-ai-practitioner-course/contracts/lesson-frontmatter.schema.json); `day`, `title` and `taskStatements` must match `site/src/data/course.yaml`.
- **Review and mock days** (7/14/21/28, 29/30): follow [`contracts/review-and-mock-days.md`](specs/001-aws-ai-practitioner-course/contracts/review-and-mock-days.md).
- **Questions:** `site/src/content/questions/<set>.yaml` (`day-NN`, `week-N`, `mock-N`), schema [`contracts/question.schema.json`](specs/001-aws-ai-practitioner-course/contracts/question.schema.json). Daily sets 15–20, weekly 55–60, mocks exactly 65 with the 13/16/18/9/9 domain split. Every option needs an explanation; `lessonRef` must point to a core lesson section.
- **Diagrams:** `<Diagram caption="…" code={`mermaid…`} />` — rendered to `public/diagrams/<hash>.svg` at build time (`npx tsx scripts/render-diagrams.ts`), so no runtime JavaScript and the strict CSP holds.
- **Glossary / service cards:** `site/src/content/glossary/*.yaml`, `site/src/content/services/*.yaml`.
- **Exam guide data:** `site/src/data/exam-guide.yaml` — re-check against the [live AIF-C01 guide](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html) when AWS publishes a new version, then update `lastVerified` in lessons.

After any content change: `npm run validate:content && npx vitest run tests/unit/question-sets.test.ts`.

## 6. Project structure

```text
site/
  src/
    content/        lessons (MDX), questions, glossary, services (YAML)
    data/           exam-guide.yaml, course.yaml (30-day calendar)
    components/     lesson/, quiz/, mock/, review/, dashboard/, account/, settings/, lookup/
    layouts/        BaseLayout, LessonLayout, ReviewLayout, MockDayLayout
    pages/          / (course catalogue; course #1 = this course, data in src/data/courses.yaml; /courses → 301 /) · /course/aws-ai-practitioner (course dashboard) · /login · /signup · /day/[day] · /mock/[n] · /outline · /search · /glossary · /cheatsheet/* · /coverage · /settings · /design/* (mockups + test fixtures)
    lib/            scoring, quiz-state, mock, schedule, ui-state, progress/ (store, io, legacy import, section-tracker), validate
    schemas/        JSON Schemas (Ajv, compiled at build) + Zod collection schemas
    styles/         theme.css (design tokens), feature CSS
  server/           Node server: static files from dist/, auth + sessions, JSON API, SQLite (contracts/server-api.md)
  data/             aip.db (SQLite, gitignored; e2e runs use data/e2e/)
  scripts/          validate-content, render-diagrams, build-validators, audit-tasks, perf-check
  tests/unit/       Vitest
  tests/e2e/        Playwright specs, helpers, review + visual screenshots
specs/001-aws-ai-practitioner-course/   spec.md, plan.md, tasks.md, data-model.md, contracts/, research.md, reviews/review-log.md, design/
.specify/, .github/skills/              Spec Kit configuration and agent skills
```

## 7. Project workflow (Spec Kit)

The project follows [Spec Kit](https://github.com/github/spec-kit) with a test-first constitution (`.specify/memory/constitution.md`):

1. `speckit-specify` → `spec.md`; `speckit-clarify` for open questions; `speckit-plan` → `plan.md`, `data-model.md`, `contracts/`.
2. `speckit-tasks` → `tasks.md`: every task lists test cases (TC), plan and verification.
3. Per task (Quality Gate in `tasks.md`): write tests → see them fail → implement → tests pass → lint/typecheck/validate → capture and **inspect** screenshots → commit `T###: summary`.
4. One multi-model review at the end (`reviews/review-log.md`), then `npm run verify` and `npm run audit:tasks -- --final`.

New work: add tasks to `tasks.md` (next free `T###`), follow the gate, tick the task with a short "Done:" note.

## 8. Security and privacy

- A small local server (no analytics, no external requests at runtime — fonts, diagrams and search are local). Passwords are hashed with scrypt; sessions are random tokens in an `HttpOnly`, `SameSite=Lax` cookie (only their hash is stored); API writes require a CSRF header and same-origin requests; login and sign-up are rate-limited and errors never say whether the username or the password was wrong.
- The server listens on `127.0.0.1` by default; `HOST=0.0.0.0` exposes it to your network, and anyone who can reach the port (or a public forwarded URL) can create an account. Sign-up is limited per IP per hour (`AIP_SIGNUPS_PER_HOUR`) and in total (`AIP_MAX_USERS`, default 50); keep forwarded ports private where possible.
- Strict Content-Security-Policy (`default-src 'self'`, hashed scripts/styles); `/search` adds only `'wasm-unsafe-eval'` for Pagefind.
- Progress is stored only in your SQLite file; it leaves it only through an explicit export. Saved progress and imports are size-limited, parsed with `JSON.parse` and schema-validated (imports also require confirmation).

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `Error: Cannot find module @rollup/rollup-linux-…` / esbuild platform errors | `node_modules` was installed by another OS — run npm through the same OS that installed it (see Prerequisites) or reinstall. |
| Search page says search is unavailable | Run `npm start` (the index is built by Pagefind during the build). |
| Progress isn't saved | You are signed out (see the banner on lessons) — sign in; on a forwarded URL / other address sign in there too. |
| Forgot a password | There is no e-mail reset (local app). Create a new account (old progress can be moved only from a JSON export), or start over by resetting the database file. |
| `node:sqlite` not found / `DatabaseSync` errors | Use Node 22 (see Prerequisites). |
| E2E port already in use | Stop the other server on that port (the suite never reuses one), or set `E2E_PORT`. |
| Visual test fails after an intended UI change | Inspect `test-results/**/…-diff.png`, then `npx playwright test visual --update-snapshots=all`. |
| Lesson time check fails in `validate:content` | Core reading time must be 50–70 min and within ±15 % of `estimatedMinutes` (words ÷ 130 + diagrams + 8 lab + 1/quiz question). |

---

Independent study aid — not affiliated with or endorsed by Amazon Web Services. Exam facts verified against the AIF-C01 v1.2 exam guide on 2026-11-02.
