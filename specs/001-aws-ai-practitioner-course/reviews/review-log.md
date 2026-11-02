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

## Final validation + multi-model swarm review — Phases 5–11 (T063–T181) — 2026-11-02

Built in parallel: 3 code worktrees (US3+US7, US4+US5, US6), 7 lesson agents (Days 4–27), 5 question-set agents (week-1..4, mock-1..3), review-day and mock-day agents; merged and re-verified on main by the coordinator (author: Claude Opus).

- Final state: 30/30 day pages (24 lessons, 4 review days, 2 mock days); 903 unique questions (24 × 20 daily, 4 × 57 weekly, 3 × 65 mocks with the exact 13/16/18/9/9 split); 166 glossary terms; 75 service cards.
- Tests: unit 347 passing; E2E 293 passing + 1 intentional skip (mobile-only route check), incl. axe on every route × light/dark × desktop/mobile, keyboard-only quiz + mock, 52 approved visual baselines, perf (interactive < 2 s at 4× CPU, search < 1 s, lesson JS < 200 KB gz), security (CSP on every route, same-origin requests only, no raw-HTML sinks). `validate:content --final` green; lint/typecheck clean.
- Issues found during integration and fixed: Shiki inline styles blocked by CSP (syntax highlighting disabled, CSS code blocks); shared Astro content cache across worktrees (test-infra only); stale "coming soon" assertions after content landed; 375px overflow on /day/29 tables; focus race in quiz e2e; W4 ratings missing from dashboard; text links distinguishable by colour only; dark-theme console-mock contrast; unlabelled Pagefind input; non-focusable scrollable tables.
- T105 (US6 review): lookup pages/content reviewed via the spec, a11y and UX passes below; lessonRefs to day pages (not sections) for Days 4–27 accepted.
- T178: live AIF-C01 guide verified (v1.2, 2026-10-29; domains, 14 task statements + objective counts, 51/51 in-scope services, curated out-of-scope/not-listed lists); 5 paraphrased task titles made verbatim.

### Swarm review (reviewer models differ from the author; GPT-6.1 Sol / Gemini 4 Argon unavailable → fallback per Quality Gate)

| Perspective | Model | Verdict | Notes |
|-------------|-------|---------|-------|
| Spec + Security | Claude Sonnet 5.5 | PASS WITH NOTES | All FR-001–026, SC, US acceptance scenarios and quickstart V1–V15 mapped to code + tests. Fixed: store crashes when storage blocked/full (memory fallback, first backup kept), FR-003 allocation test added. Accepted: `npm audit` flags astro ≤ 7.3 advisories (XSS/SSRF/image) — not reachable in this static build without SSR/image optimisation; fix requires Astro 5 → 7 major upgrade (follow-up). Accepted: progress-import schema loose on nested objects (self-inflicted DoS only; Ajv standalone needs runtime helpers for the stricter version). |
| Exam content — answer keys (Q7) | Claude Sonnet 5.5 | PASS | Blind solves: 60/60 daily Days 1–3 (Phase 4), 195/195 mocks, 227/228 weekly; the one disagreement (q-week-2-037 ambiguous ordering) reworded. |
| Exam content — facts | Claude Fable 5.1 | PASS after fixes | 37 flagged claims: 27 correct, 8 imprecise, 2 outdated. Fixed: Nova Canvas/Reel/Sonic v1 retired Sept 2026 (lessons, 9 questions with changed correct answers, glossary, Nova card); Bedrock Agents closed to new customers since 30 Jul 2026 → AgentCore for new agents; prompt-caching TTL; 4 service tiers; continued pre-training availability; prompt-retention wording; Trusted Advisor plan name. |
| UX / Visual + Accessibility | Claude Fable 5.1 | PASS WITH NOTES | Fixed HIGH: search placeholder 1.3:1 → theme muted colour; white titles on gradient cards 2.4–4.3:1 → 40 % overlay (≥ 5.4:1). Fixed MEDIUM: exam-guide card in dark theme, split section durations, Outline active on day/mock pages, legend swatch border, outlined pressed Flag. Follow-ups (not fixed): 6-tab mobile bar with ~10 px labels, glossary A–Z target size, prose paragraph spacing on mock intro, "This week" card titles clamp, footer 11 px. |

- Open: T179 manual step — open the VS Code Ports-panel forwarded URL for 4321 and repeat export → import (automated cross-origin equivalent passes in tests/e2e/port-forward.spec.ts).

## Phase 12 — learner feedback: slide lessons, schedule dates, local profiles, README (T182–T186) — 2026-11-02

- Decisions (learner): local profiles (no server/login), slides per section with a Full-page toggle, course start = profile creation date (browser), editable.
- T182 slides (agent, branch `slides`): client pager over the server-rendered article (search/print/no-JS keep the full page); viewport-fitted slides, 20 px/18 px type, owned section illustrations (13 SVGs), marker-highlighted key terms, "Key point" callouts, ←/→/PageUp/PageDown/swipe, `#slide-n`, aria-live; Full-page view remembered per browser. Coordinator inspection found slide 1 overflowing under the controls (deck measured from the viewport, not its real position) → fixed: deck fills the viewport, skip notice moves into the deck, measurement from the slide's real box; SL1 now asserts every slide's content ends above the controls at the learner's real scroll position (desktop + mobile, /day/02 and /day/15).
- T183 schedule: Day N = start + N − 1 calendar days (DST-safe), finish = start + 29; dashboard card (start, finish, today's plan day, ahead/behind), outline dates + "Today", "Planned for …" on lesson/review/mock pages, Settings start-date editor.
- T184 profiles: header "Who's learning?" menu + Settings → Learners (add/rename/switch/delete with confirm); legacy key = default profile; per-profile keys; theme and store follow the active profile; export/import per profile.
- T185 README at repo root; commands re-run as written; re-baseline command corrected to `--update-snapshots=all` (plain mode skips changes within tolerance).
- Tests: unit 373 passing; E2E 319 passing + 1 intentional skip; visual spec now freezes the browser clock (pages show dates) and waits for the profile menu. lint/typecheck clean; `validate:content --final` green.
- Open/notes: phones get many slides (~85–110 per day); on slide view the page header is scrolled just above the viewport on load; T179 manual VS Code step still open.

## T187 — learner feedback round 2 (short screens, highlights, collapsible side bars, slide position) — 2026-11-02

- From the learner's 25 %-zoom screenshot + direct requests to the slides agent: slides now fit short, wide desktop windows with no page scroll (SL1 at 1280×600, 1366×650, 1536×730, 1920×900, 1280×800; 375×812 phone kept; extra phone sizes dropped at the learner's request — mobile out of scope for now); compact slide header (title wraps to 2 lines, planned date, toggle, slide count); marker highlight limited to prose (fixed red bars on Day 1 fact cards); reading width capped at 920 px; collapsible left navigation (icon rail) and "Today's sections" (vertical tab), persisted per browser, keyboard operable, axe clean; refresh/revisit reopens the learner's slide (per browser, per day); no re-paging on scrollbar changes.
- Coordinator verification on main exposed a stale preview server on port 4321 being reused by Playwright (old build) → re-ran on a fresh build with E2E_PORT: unit 377, E2E 330 passed + 16 expected skips; lint/typecheck clean.
- Open: phones get ~110–140 slides per day (deferred); slide position is per browser, not per learner/device (addressed by the requested SQLite backend).
