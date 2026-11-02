# Review Log — 001-aws-ai-practitioner-course

One entry per task (Constitution III). Template:

```text
## T### — <title>
- Date:
- Tests: red (cmd → failing tests) / green (cmd → passing)
- Static: lint / typecheck / validate:content
- Screenshots inspected: <names, viewports, themes>
- Reviewers:
  | Perspective | Model | Verdict | Notes |
  |-------------|-------|---------|-------|
  | Spec | | | |
  | Exam content | | | |
  | UX / Visual | | | |
  | Accessibility | | | |
  | Security | | | |
- Fixes applied:
- Commit: (n/a — workspace is not a git repository yet)
```

---

## Progress note — Phases 1, 0, 2 (T001–T032) — 2026-11-02 — commit 6955e8d

- Tests: unit 122 passing (design tokens AA, theme parity, exam guide, schemas Ajv/Zod parity, scoring, store, import/export, validator, diagrams, lint guard); E2E 26 passing (foundation + 6 design mockups × light/dark × desktop/mobile, zero console/CSP errors, no horizontal scroll).
- Static: lint clean, `astro check` 0 errors, `validate:content` clean (all days pending).
- Screenshots inspected: design dashboard/lesson/mock/review (desktop + mobile, light + dark) against the Figma captures — layout, colours and radii match; fixed grid overflow, CSS layer order, mobile search pill.
- Early review (GPT-6.1 Sol, spec + security) findings fixed: host allowlist instead of `allowedHosts: true`; Zod parity (unique domains, calendar dates); deepDive optional/last + duplicate section ids; ordering/matching answer completeness; optional `ratings` normalised; audit script stub. Accepted deviations recorded in tasks.md (130 wpm timing formula, build-time SVG diagrams, `/design/` route).
- Per Constitution v2.0.0 the full multi-model swarm review runs once in T181.

## Progress note — Phase 3 / US1 (T033–T048) — 2026-11-02

- Tests: unit 133 passing (adds U3 `estimateMinutes`, TC-Q Q2–Q4 cross-set checker with self-tests on broken fixtures); E2E 40 passing — content-day TC-L for Days 1–3 (section order, diagrams + alt, deep-dive diagram, real-world, lab steps with captions, recap of Day N−1), lesson-ui U5–U9 (nav highlights current section, collapses on mobile; deep dive collapsed/"Optional"; prev/next; skip-ahead notice; Day 1 exam facts).
- Static: lint clean, `astro check` 0 errors, `validate:content` clean (Days 1–3 within L6 50–70 min).
- Components: SectionNav.astro (sticky desktop, collapsible `<details>` on mobile) and DeepDive.astro extracted; HandsOnLab steps wrapped in `<figure>`/`<figcaption>`.
- Screenshots inspected: `lesson-nav` desktop + mobile, `day-02` lab region, `day-01..03` desktop overview, `lesson-deepdive-open`, `day1-orientation`. No overlap, truncation or horizontal scroll.
- Deviations: see T048 note in tasks.md. Exam-content review of Days 1–3 runs in T181.

## Progress note — Phase 4 / US2 (T049–T062) — 2026-11-02

- Tests: unit 154 passing (adds quiz-state Q-S1–Q-S3, TC-Q Q1–Q6 on day-01..03); E2E 44 passing — quiz.spec Q-E1 (mouse and keyboard-only for single/multi/ordering/matching), Q-E2 confirm on unanswered, Q-E3 results with %, correct answer, every option explanation and "Review in lesson" link, Q-E4 best score after reload, Q-E5 retake. lesson-ui + quiz ran 5× each with no flakes after two fixes: nav highlight now computed from layout (late image loads had left a stale highlight), ordering focus restored only once the moved item is in place.
- Static: lint clean, `astro check` 0 errors, `validate:content` clean (60 questions).
- Content: 60 questions (each day 14 single / 4 multi / 1 ordering / 1 matching; answer positions spread). Blind answer-key solve by Claude Sonnet: 60/60 agreement; one wording fix, two lessonRefs moved off the optional deep dive.
- Screenshots inspected: `quiz-single`, `quiz-ordering`, `quiz-matching`, `quiz-results` desktop + mobile (light). Fixed on mobile: ordering text column squeezed by unbreakable words and the ↓ button touching the card edge; Next button wrapping onto its own line. Not yet captured: dark theme of the quiz (components use theme variables only) — covered by T175 visual regression.
