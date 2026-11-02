<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0 (MAJOR: Principle III redefined)
- Modified principles:
  - III. Multi-Model Swarm Review: per-task review → single final review before release
    (reason: token cost; requested by learner 2026-11-02)
- Modified sections: Development Workflow & Quality Gates (step 5 moved to release gate); Governance
  (compliance review references)
- Removed sections: none
- Templates requiring updates: none (read at runtime)
- Feature artifacts updated: specs/001-aws-ai-practitioner-course/tasks.md Quality Gate + final review task
- Deferred TODOs: none
-->

# AWS AI Practitioner Course Constitution

## Core Principles

### I. Exam-Guide Fidelity

- All learning content MUST map to a task statement in the current official AWS Certified AI
  Practitioner exam guide (currently AIF-C01 v1.2, published 2026-10-29).
- Exam facts (format, domains, weights, in-scope/out-of-scope services) MUST be verified against the
  live AWS documentation before authoring and again before release; each lesson MUST carry a
  `lastVerified` date and the exam guide version.
- Services that are discontinued or out of scope MUST NOT be taught as exam content; they MAY appear
  only as clearly labelled "Exam Trap" or "Beyond the exam" notes.
- Study time and question counts MUST be proportional to official domain weights.
- Content MUST be original wording; third-party courses are referenced, never reproduced.

Rationale: the course exists to pass the real exam; stale or off-scope material wastes study hours.

### II. Test-First Delivery (NON-NEGOTIABLE)

- Every task MUST define its test cases (TC) before implementation, written as
  Given/When/Then with stable ids.
- Tests MUST be written and observed failing (red) before implementation, then passing (green).
- Content is code: every lesson and question set MUST have automated checks (schema, coverage,
  counts, required sections, answer-key integrity) and a page-level end-to-end test.
- A task MUST include an implementation plan (ordered steps) and a verification block
  (commands, expected results, screenshot names) before work starts.

Rationale: test-first prevents silent gaps in a 30-day, 900+ question course.

### III. Multi-Model Swarm Review (NON-NEGOTIABLE)

- The feature MUST pass one swarm review before release (not per task), covering at least these
  perspectives: Spec, Exam-content accuracy, UX/Visual, Accessibility, Security.
- Reviewers MUST be run on at least two different AI models, with the Exam-content reviewer on a
  different model from the author of the content; the model used per perspective MUST be recorded.
- Consensus rule: all perspectives MUST return PASS; any FAIL is fixed and the failing perspectives
  re-run.
- The review MUST be logged (date, scope, tests run, screenshots, model per reviewer, verdicts, fixes)
  in the feature's `reviews/review-log.md`.

Rationale: different models catch different errors; one end-of-feature review keeps cost reasonable
while per-task automated gates catch regressions early.

### IV. Visual & End-to-End Verification

- Every user-visible change MUST be verified by end-to-end tests that capture screenshots at
  desktop (1280×800) and mobile (375×812) sizes, in light and dark themes where relevant.
- Screenshots MUST be opened and visually inspected (layout, overlap, truncation, colour, diagram
  rendering, no horizontal scroll) before a baseline is approved; later changes MUST pass visual
  regression against the approved baseline.
- Each phase MUST end with a regression run of all prior tests and screenshots.
- A final validation MUST audit that every completed task has passing tests and its screenshots.

Rationale: a learning site is judged by what the learner sees; tests alone miss visual defects.

### V. Design-First, Learner-Centred Experience

- UI work MUST follow an approved design reference (Figma or equivalent) and its exported design
  tokens; visual reviews compare screenshots against the approved design.
- The experience MUST be colourful, friendly and consistent: one colour per exam domain, colour-coded
  callouts, visible progress, streaks and badges.
- Each daily lesson MUST fit ~60 minutes of core study, start with a recap, include at least one
  diagram, a real-world scenario, a hands-on read-through and a quiz; deeper material MUST be
  marked optional.
- Learner progress MUST never be lost silently; the learner MUST always be able to resume in one
  click.

Rationale: an engaging, predictable daily routine is what gets the learner to day 30.

### VI. Accessibility & Inclusive Learning

- The site MUST meet WCAG 2.2 AA contrast, be fully keyboard operable, and provide text captions for
  every diagram and visual.
- Automated accessibility checks MUST report zero serious or critical violations on every route.
- Animations MUST respect reduced-motion preferences; language MUST be plain and beginner-friendly.

Rationale: learning material must be usable by everyone, on any device.

### VII. Simplicity, Privacy & Security

- Prefer the simplest architecture that meets the spec: a static site, no backend, no login, no
  runtime calls to external services or CDNs.
- Learner data stays on the learner's device; imports MUST be size-limited, parsed as data only and
  schema-validated before use.
- Untrusted data MUST never be rendered as HTML; a restrictive Content Security Policy MUST be set.
- Hands-on activities MUST NOT require an AWS account, credentials or spend.
- New dependencies or complexity MUST be justified in the plan's Complexity Tracking.

Rationale: fewer moving parts means fewer failures and no privacy or cost risk to the learner.

## Content & Quality Standards

- Question bank: every question MUST have a domain, task statement, lesson reference, the correct
  answer and an explanation for every option; question ids MUST be unique and mock exams MUST NOT
  reuse questions from other sets.
- Every exam task statement MUST have at least three practice questions.
- Mock exams MUST mirror the official format (question count, duration, question types, domain
  weighting, scaled pass mark).
- Lesson timing MUST be checked against content length, not only declared minutes.

## Development Workflow & Quality Gates

Every task follows this gate sequence; a task is complete only when all gates pass:

1. TC defined → tests written → tests fail for the right reason.
2. Implement per the task's plan → tests pass.
3. Lint, type checks and content validation are clean.
4. End-to-end tests and screenshots captured and visually inspected (Principle IV).
5. Commit with the task id in the message.

Phase checkpoints re-run the full regression suite. The feature is releasable only after the final
multi-model swarm review (Principle III), the final validation audit and the quickstart validation
scenarios pass.

## Governance

- This constitution supersedes other practices for this repository. Plans MUST include a
  Constitution Check against these principles; `/speckit-analyze` treats violations as CRITICAL.
- Amendments: propose the change with rationale, update this file via `/speckit-constitution`,
  record a Sync Impact Report, and update affected specs, plans and tasks in the same change.
- Versioning (semantic): MAJOR for removing or redefining a principle; MINOR for adding a principle or
  section or materially expanding guidance; PATCH for clarifications and wording.
- Compliance review: at every phase checkpoint the automated gates (Principles II and IV) are
  re-run; before release the swarm review (Principle III) is performed and logged.

**Version**: 2.0.0 | **Ratified**: 2026-11-02 | **Last Amended**: 2026-11-02
