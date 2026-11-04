# Tasks — 002 Learn30 multi-course platform

Gate (Constitution v4.0.0): unit + static + content validation + `npm run test:sanity` + the specs covering the change; full e2e only when the learner says "all". `[P]` = parallel (separate worktree, owned files).

## W0 Foundation (coordinator)
- [x] L001 Route helpers `src/lib/routes.ts` (courseHref, courseIdFromPath, legacyCoursePath) + contracts/routes.md
- [x] L002 Course loader contract `src/lib/course-data.ts` (getCourse, allCourses, CourseRules) + `src/lib/course-content.ts` (lessonsOf/questionsOf/glossaryOf/servicesOf), interim single-course implementation
- [x] L003 Spec, plan, contracts (routes, progress-api-v2, course-folder); constitution v4.0.0

## W1 Content & validation [P]
- [x] L010 Move data to `src/courses/aws-ai-practitioner/{course,exam-guide,rules}.yaml` (+ metrics.ts); content to `src/content/<collection>/aws-ai-practitioner/…`; course-prefixed collection ids + `courseId`
- [x] L011 Implement getCourse()/course-content helpers over the folders; retire `src/lib/data.ts` globals (keep a thin shim only if needed)
- [x] L012 Per-course validation (`validate.ts` takes CourseRules; `scripts/validate-content.ts` loops courses); fixture-course inclusion via `AIP_FIXTURE_COURSES=1`

## W2 Routes & pages [P]
- [x] L020 `src/pages/course/[course]/…` (index, day/[day], mock/[n], outline, glossary, cheatsheet/[sheet], coverage, search) via getCourse/course-content; remove root pages
- [x] L021 All course links via courseHref (≈25 call sites); Pagefind `course` filter + course-scoped search
- [x] L022 server/access.ts: narrowed sign-in rule + legacy 301s via legacyCoursePath

## W3 Progress per course [P]
- [x] L030 DB migration (progress PK user+course; theme → ui_state), API v2 + alias + summary, bootstrap course/summary
- [x] L031 Client: getStore(courseId) (default from `<html data-course>`), ui-state slides `<course>:<day>`, local keys v2 + legacy import, schema v2
- [x] L032 Settings: per-course start date / export / import / reset; theme global

## W4 Shell, menu, branding [P]
- [x] L040 Context-aware sidebar + mobile tabs (course group only on course pages; My courses on global pages); `<html data-course>`
- [x] L041 Learn30 branding (title, mark, meta, README, package name); exam facts only on course pages (footer, support card, mock intro)
- [x] L042 Catalogue cards with each course's progress (summary); dashboard breadcrumb from registry

## W5 Tests & fixture course [P]
- [x] L050 Fixture course `tests/fixtures/courses/demo-course` (3 days, 1 mock) + build flag in `build:e2e`
- [x] L051 Tests use route helpers; `multi-course.spec.ts` (two cards, separate progress, menu per course, no course group on global pages, legacy redirects); unit tests (loader, migration, summary)

## Integration
- [x] L060 Merge W1–W5; gate; screenshots 1366×768 + 1280×550@1.5; sanity for both courses
- [ ] L061 Full regression on learner's "all" (+ baselines after inspection); review log
