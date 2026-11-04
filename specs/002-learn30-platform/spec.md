# Feature 002 — Learn30: a multi-course platform

**Status**: Approved plan (learner, 2026-11-04) · **Builds on**: 001-aws-ai-practitioner-course

## Why
The site was built for one course. The learner wants a course catalogue, more courses later, and a site that reads as one platform (not "AI Practitioner" everywhere). Decisions (learner): name **Learn30**; course pages under `/course/<id>/…` with old addresses redirecting; **separate progress per course**.

## User stories
- **US1 Catalogue (P1)** — As a learner I open the site and see the courses (Learn30 home), each with my progress and Continue/Start.
  - Given two available courses, when I open `/`, then I see two cards; each shows that course's own progress.
- **US2 Course context (P1)** — Inside a course the menu shows that course (its title, dashboard, outline, search, glossary, cheat sheets); on global pages it shows no course group.
  - Given I am on `/course/<a>/day/02`, then the course group is titled with course A and every link points into A; given I am on `/` or `/settings`, then there is no course group (only Courses, My courses, Settings).
- **US3 Separate progress (P1)** — Progress, quiz attempts, schedule (start/finish), streak and slide position are kept per course; my existing progress appears under the AWS course.
  - Given progress in course A, when I open course B, then B shows 0 days done; given a pre-Learn30 account, when I sign in, then the AWS course shows my previous progress.
- **US4 Old links keep working (P2)** — `/day/NN`, `/outline`, `/mock/N`, `/glossary`, `/cheatsheet/*`, `/coverage`, `/search` redirect (301) into the AWS course.
- **US5 Neutral branding (P2)** — The platform is "Learn30" (title, logo, README); exam facts (exam code, guide version, "not affiliated with AWS") appear only on that course's pages.
- **US6 Add a course without code (P2)** — A new course = one registry entry + one content folder; validation runs per course.

## Functional requirements
- FR-L1 Routes per contracts/routes.md; course links only via `courseHref()`.
- FR-L2 Course data only via `getCourse(id)` (contracts/course-folder.md); per-course `rules.yaml` drives mock size/split, quiz sizes, minimum bank size.
- FR-L3 Progress API v2 per contracts/progress-api-v2.md; one-time migration of existing rows to `aws-ai-practitioner`; theme becomes an account/UI setting.
- FR-L4 Context-aware menu (desktop sidebar + mobile tab bar) and Learn30 branding.
- FR-L5 Search scoped to the current course (Pagefind filter).
- FR-L6 A fixture course exists only in e2e builds to prove multi-course behaviour.

## Success criteria
- SC-L1 Adding the fixture course required no code changes beyond the registry flag.
- SC-L2 No "AI Practitioner"/"AIF-C01" text on global pages.
- SC-L3 Existing accounts keep all progress after upgrade (migration test).
- SC-L4 Sanity suite green for both courses + global pages.
