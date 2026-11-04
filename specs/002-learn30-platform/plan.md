# Learn30 — from one course to a multi-course platform

## Context
The site was built for one course (AWS Certified AI Practitioner, AIF-C01). We have just added a Courses catalogue on top of it, but almost every layer still assumes that single course:
- **Branding:** "AIP · 30", the exam-code support card and the AWS footer.
- **Data and routes:** global `course`/`examGuide` in `src/lib/data.ts`, and routes at the site root (`/day/NN`, `/outline`, `/glossary`).
- **Storage:** one progress row and one UI-state row per user (`server/db.ts`), and a schema that hard-codes days 1–30, D1–D5 and mock 1–3.
- **Menu:** a sidebar that always shows the AWS course group, even on the catalogue or login page.

The learner asked how this behaves when more courses are added. Their decisions:
- Platform name **Learn30**.
- All course pages **under the course** (`/course/<id>/…`), with old addresses redirecting.
- **Separate progress per course.**

The outcome: adding a course means adding one folder of content plus one registry entry, with no code changes. The menu follows the selected course, and nothing outside a course says "AI Practitioner".

## Target design

**URLs**
- Global pages:
  - `/`: catalogue (public)
  - `/settings`: account settings (protected)
  - `/login`, `/signup`
- Course pages, all under `/course/<id>`:
  - `/course/<id>`: dashboard (protected)
  - `/course/<id>/day/NN`, `/outline`, `/glossary`, `/cheatsheet/<sheet>`, `/coverage`, `/search`: public
  - `/course/<id>/mock/N`: protected
- Legacy redirects (301, query and hash kept): `/day/NN`, `/outline`, `/mock/N`, `/glossary`, `/cheatsheet/*`, `/coverage`, `/search` → `/course/aws-ai-practitioner/…`. `/courses` → `/` (already done).

**Content layout**
- Each course has its own folder: `src/courses/<id>/{course.yaml, exam-guide.yaml, rules.yaml, metrics.ts?}`.
- Each collection is split by course: `src/content/{lessons,questions,glossary,services}/<id>/…`. Collection entry ids are prefixed `<id>/`.
- `src/data/courses.yaml` remains the registry: id, title, shortTitle, examCode, status, lengthDays, accent, illustration.

**Course loader**
- `src/lib/course-data.ts` provides `getCourse(id)`, returning `{meta, course, examGuide, rules, lessons, questions, glossary, services}`, plus `allCourses()`.
- It replaces the global imports from `src/lib/data.ts`, which becomes a thin compatibility wrapper during migration and is then deleted.
- Course-specific validation rules move out of `src/lib/validate.ts` constants into `rules.yaml` per course: mock count and size, domain split, mock days, minimum questions, exam-guide id regex.

**Progress per course**
- Database:
  - The `progress` table moves to primary key `(user_id, course_id)`. A one-time migration in `server/db.ts` moves existing rows to `aws-ai-practitioner`.
  - `ui_state` stays per user.
  - Theme moves from `progress.settings` to `ui_state.theme`, migrated once.
- API:
  - `GET/PUT /api/courses/<id>/progress`.
  - `GET /api/progress/summary` returns completed days, start date and last position per course, for the catalogue.
  - `/api/progress` keeps working as an alias of the AWS course for one release.
- Page bootstrap (`server/app.ts`): `{user, ui, course: {id, progress} | null, summary}`, where the course id comes from the URL.
- Client:
  - `getStore(courseId)` in `src/lib/progress/store.ts`.
  - `ui.slides` keyed by `<courseId>:<day>`.
  - Signed-out local keys include the course id.
  - `progress-schema.json` v2: the day, domain and assessment ranges are no longer fixed, and per-course checks happen in code against `rules.yaml`.
  - Old saves are still accepted.

**Menu and branding**
- On a course page the sidebar shows, in order:
  - **Courses**
  - the course group: the course's own short title, plus Dashboard, Outline, Search, Glossary and Cheat sheets for that course
  - **Settings**
- On global pages (catalogue, settings, auth) it shows **Courses**, a **My courses** list of courses with progress, and **Settings**. No course group is shown there.
- The mobile tab bar follows the same context.
- Brand: **Learn30** (`<title>… · Learn30`), with a new neutral mark. Package name `learn30`. README is retitled.
- Exam-specific facts appear only on that course's pages: the exam-code card, "Exam guide vX · last verified", "not affiliated with AWS" and the mock "same format as the real AIF-C01" text. They're read from that course's `exam-guide.yaml`.
- Kept on purpose: the internal identifiers `aip-…` storage keys, `X-AIP-Request` and `#aip-bootstrap`. Renaming them would break stored data and sessions for no learner-visible gain.

**Proof that multiple courses work**
- A tiny fixture course, `demo-course` (3 days, 1 mock, a few questions), lives under `tests/fixtures/courses/`.
- It's included only in the e2e build (`AIP_FIXTURE_COURSES=1` → `build:e2e`). No fake course ever ships.

## Workstreams (Constitution v3.0.0 Principle VIII — parallel, file ownership)

**W0 Foundation (coordinator, first, small)**
- Registry fields, the `CourseContext` type, `getCourse()` signature, and the route helpers `courseHref(id, page, arg?)` and `isCoursePath()` in `src/lib/routes.ts`.
- Spec `specs/002-learn30-platform/` (spec.md, plan.md, tasks.md, contracts for routes, progress API v2 and course folder layout).
- Constitution amendment: title "Learn30 Constitution". Principle I becomes "Course-guide fidelity", applied per course.
- Everything below builds on these interfaces.

Then in parallel:
- **W1 Content and validation:** move content and data into per-course folders; `content.config.ts` with course-prefixed ids; `getCourse()` implementation; `rules.yaml`; `validate.ts` and `scripts/validate-content.ts` loop over every course; diagram script unchanged (hash names).
  - Owns: `src/content/**`, `src/courses/**`, `src/content.config.ts`, `src/lib/course-data.ts`, `src/lib/validate.ts`, `scripts/*`.
- **W2 Routes and pages:** `src/pages/course/[course]/…` with getStaticPaths over `allCourses()`. Replace every inline `/day/${pad()}`, `/mock/${n}`, `/outline` and similar link with `courseHref`; the explorer listed about 25 sites. Pagefind: `data-pagefind-filter="course:<id>"` and a course-filtered search page. Legacy redirects and narrowed access rules in `server/access.ts`.
  - Owns: `src/pages/**`, `src/layouts/{Lesson,Review,MockDay}Layout.astro`, lesson, mock and lookup components, `server/access.ts`.
- **W3 Progress per course:** DB migration, API v2 and alias, bootstrap, `getStore(courseId)`, ui-state keys, schema v2, legacy-import mapping, and the settings page (export, import and reset per course; start date per course).
  - Owns: `server/{db,api,app}.ts`, `src/lib/progress/**`, `src/lib/{ui-state,bootstrap,api}.ts`, `src/schemas/progress-schema.json`, settings components.
- **W4 Shell, menu and branding:** context-aware `BaseLayout` menu, My courses, Learn30 branding, course-scoped footer and card, catalogue cards showing each course's progress from the summary, README and package name.
  - Owns: `BaseLayout.astro`, `theme.css` nav and brand, `src/components/courses/**`, dashboard breadcrumb, README, `package.json` name.
- **W5 Tests and fixture course:** the `demo-course` fixture and build flag; route helpers in tests (`routes.ts`, `fixtures.ts`); new `multi-course.spec.ts`:
  - two cards on the catalogue
  - each course keeps separate progress
  - the menu switches with the course
  - the global pages show no course group
  - legacy redirects work
  - Unit tests for the loader, the migration and the summary.
  - Owns: `tests/**`, `playwright.config.ts`.

**Integration (coordinator):** merge, unit, static, validation, the sanity suite and the specs covering each change, plus screenshots at 1366×768 and at 1280×550 with 1.5× scale. Then, with the learner's "all", the full suite with `--update-snapshots=all` after inspection, the Phase review log, and one commit per workstream.

## Critical files
- `src/lib/data.ts` (to be replaced) and `src/lib/routes.ts`
- `src/content.config.ts`
- `src/layouts/BaseLayout.astro`
- `server/db.ts`, `server/api.ts`, `server/app.ts`, `server/access.ts`
- `src/lib/progress/store.ts`, `src/lib/ui-state.ts`
- `src/schemas/progress-schema.json`, `src/lib/validate.ts`
- `src/pages/**`
- `tests/e2e/{routes,fixtures}.ts`

Reuse: `buildPlan` (`src/lib/course-plan.ts`), the schedule helpers (`src/lib/schedule.ts`), the dashboard helpers (`src/lib/dashboard.ts`), `AttemptHistory`, and `day-complete.ts`. All of them become course-parameterised, not rewritten.

## Verification
- `npm run lint`, `npm run typecheck`, `npx vitest run`, and `validate-content --final`, which must pass for every course including the fixture course in e2e builds.
- `npm run test:sanity`, extended to both courses and the global pages.
- `multi-course.spec`, `auth.spec`, `slides.spec`, `quiz.spec`, `mock.spec`.
- A database migration test: an old database with one progress row opens with that progress under the AWS course.
- Manual: restart `npm start`.
  - An existing account still sees its progress under AWS.
  - `/day/02` redirects.
  - The menu changes between the catalogue and a course.
  - No "AI Practitioner" text appears on global pages.
- The full e2e suite only when the learner says "all".
