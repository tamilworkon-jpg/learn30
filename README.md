# AIP 30 — AWS Certified AI Practitioner in 30 days

A free, offline-friendly study website for the **AWS Certified AI Practitioner (AIF-C01, exam guide v1.2)** exam: 30 one-hour days of lessons shown as screen-sized slides, daily quizzes, weekly reviews, three full 65-question mock exams, a glossary and cheat sheets. Progress is saved per learner in the browser — no account, no server.

| | |
|---|---|
| Content | 24 lesson days · 4 weekly review days · 2 mock-exam days · 903 exam-style questions · 166 glossary terms · 75 service cards |
| Stack | Astro 5 (static) + MDX · Preact islands · Tailwind CSS v4 · build-time Mermaid SVG · Pagefind search · Vitest · Playwright + axe |
| Spec | [`specs/001-aws-ai-practitioner-course/`](specs/001-aws-ai-practitioner-course/) — spec, plan, tasks, contracts, review log |

---

## 1. Prerequisites

- **Node.js 22** (≥ 22.12; 22.19+ avoids `undici` engine warnings) and npm 10.
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

Production build and preview (what learners actually use):

```bash
npm run build          # validators + diagrams → astro build → Pagefind search index (dist/)
npm run preview        # serves dist/ on http://localhost:4321 (and on your LAN: host: true)
```

Search only works on `build` + `preview` (the index is generated at build time).

### Use it on your phone / another device (port forwarding)

1. `npm run build && npm run preview -- --host`
2. VS Code → **Ports** panel → **Forward a Port** → `4321` → open the forwarded URL on the other device.
3. Progress is stored **per address** (localhost and the forwarded URL are different origins). Move it with **Settings → Export progress** on one and **Import progress file** on the other.

## 3. Using the site

- **Learners (profiles):** the avatar in the top-right opens **Who's learning?** — switch or add learners. **Settings → Learners** renames or deletes them. Each learner has separate progress, start date, quiz attempts and theme. No passwords: anyone using the browser can switch learners.
- **Schedule:** a learner's course starts on the day the profile is created (browser date); Day N is planned for start + N − 1 and the course finishes 29 days later. The dashboard shows start, finish, today's plan day and whether you're ahead or behind; the outline shows a date for every day. Change it in **Settings → Your schedule**.
- **Lessons as slides:** each lesson section becomes screen-sized slides with big type, a visual on every slide and highlighted key terms. Navigate with the buttons, ←/→ keys or swipe; **Full page** switches back to the long view (used for printing and search).
- **Quizzes and mocks:** answers save as you go; results explain every option and link back to the lesson section. Mock exams are timed (90 min) with a palette, flags and a review screen; scores use the 100–1000 scale (pass 700).
- **Backup:** Settings → Export / Import (JSON, validated, ≤ 1 MB) and Reset (with confirmation) act on the current learner.

## 4. Quality checks

All commands run from `site/`.

| Command | What it does |
|---|---|
| `npm run lint` | ESLint (bans `innerHTML`/`outerHTML`) |
| `npm run typecheck` | `astro check` (TypeScript + Astro) |
| `npm run validate:content` | Lesson structure, timing (50–70 min), question sets, coverage per task statement, glossary/service cards |
| `npx tsx scripts/validate-content.ts --final` | Release gate: also requires all 30 days, ≥ 900 unique questions, ≥ 3 questions per task statement |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:e2e` | All browser tests (Playwright: desktop 1280×800 + mobile 375×812; builds and previews automatically) |
| `npm run test:visual` | Only the `@visual` specs (screenshots in `tests/e2e/__screenshots__/`) |
| `npm run verify` | lint + typecheck + validate + unit + e2e |
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
    components/     lesson/, quiz/, mock/, review/, dashboard/, profiles/, settings/, lookup/
    layouts/        BaseLayout, LessonLayout, ReviewLayout, MockDayLayout
    pages/          / · /day/[day] · /mock/[n] · /outline · /search · /glossary · /cheatsheet/* · /coverage · /settings · /design/* (mockups + test fixtures)
    lib/            scoring, quiz-state, mock, schedule, progress/ (store, profiles, keys, io, section-tracker), validate
    schemas/        JSON Schemas (Ajv, compiled at build) + Zod collection schemas
    styles/         theme.css (design tokens), feature CSS
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

- Static site; no server, no analytics, no external requests at runtime (fonts, diagrams and search are local).
- Strict Content-Security-Policy (`default-src 'self'`, hashed scripts/styles); `/search` adds only `'wasm-unsafe-eval'` for Pagefind.
- Progress never leaves the browser except through an explicit export. Imports are size-limited, parsed with `JSON.parse` and schema-validated, and require confirmation.

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `Error: Cannot find module @rollup/rollup-linux-…` / esbuild platform errors | `node_modules` was installed by another OS — run npm through the same OS that installed it (see Prerequisites) or reinstall. |
| Search page says search is unavailable | Run `npm run build && npm run preview` (the index is built by Pagefind). |
| E2E port already in use | Stop the other preview server, or set `E2E_PORT`. |
| Visual test fails after an intended UI change | Inspect `test-results/**/…-diff.png`, then `npx playwright test visual --update-snapshots=all`. |
| Lesson time check fails in `validate:content` | Core reading time must be 50–70 min and within ±15 % of `estimatedMinutes` (words ÷ 130 + diagrams + 8 lab + 1/quiz question). |

---

Independent study aid — not affiliated with or endorsed by Amazon Web Services. Exam facts verified against the AIF-C01 v1.2 exam guide on 2026-11-02.
