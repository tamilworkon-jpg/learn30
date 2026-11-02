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
