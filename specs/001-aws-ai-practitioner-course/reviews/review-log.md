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
