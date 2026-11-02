# UI Routes Contract

All routes are static, root-relative (work on `localhost:4321` and VS Code forwarded URLs).

| Route | Page | Key elements | Spec refs |
|-------|------|--------------|-----------|
| `/` | Dashboard | Overall % ring, "Continue where you left off" (→ `lastPosition`), current day card, streak, badges, weak domains, week timeline, exam guide version + last verified | US3, FR-017 |
| `/outline` | Course outline | Weeks → days → sections, status icons, domain colour chips, skip-ahead allowed | FR-018, FR-020 |
| `/day/[NN]` | Lesson (Days 1–6, 8–13, 15–20, 22–27) | Sticky section nav, callouts, Mermaid diagrams, read-through lab, quiz island, optional Deep Dive, "Mark complete", prev/next | US1, US2, FR-005, FR-005a |
| `/day/[NN]#[sectionId]` | Section deep link | Used by resume, search results, question `lessonRef` | FR-014, SC-004 |
| `/day/07`, `/day/14`, `/day/21`, `/day/28` | Weekly review | Domain-grouped summary, concept map, 55–60-question cumulative test, per-domain results with links, Day-end 1–5 engagement rating | US4, FR-007, FR-026 |
| `/day/29`, `/day/30` | Mock day | Launch Mock 1 / Mock 2 (Mock 3 on Day 30), remediation plan, exam-day strategy | US5, FR-008 |
| `/mock/[1-3]` | Mock exam runner | Countdown 90:00, question palette, flag, review screen, auto-submit, scaled score, domain breakdown, pass/fail at 700 | FR-015 |
| `/glossary` | Glossary | A–Z, filter by domain, links to lessons | FR-009 |
| `/cheatsheet/services` | AWS service → use case | Category, purpose, "choose when", "not this", in/out of scope badge | FR-009 |
| `/cheatsheet/metrics` | Metrics sheet | Classification, regression, GenAI metrics, business metrics | FR-009 |
| `/coverage` | Exam coverage matrix | Task statement → days → question count | FR-002, SC-001 |
| `/search` | Search | Full-text over lessons, glossary, cheat sheets | FR-020, SC-006 |
| `/settings` | Settings | Theme, export progress, import progress (validated), reset (confirm) | FR-018, FR-019 |

## Interaction contracts

- **Resume**: Viewing a section (≥50% in viewport for 3 s) updates `lastPosition` and `sectionsViewed`.
- **Quiz submit**: Unanswered allowed with confirm; results show per-question correct answer + all option explanations + link to `lessonRef`.
- **Mock timer**: deadline stored in `inProgress`; reload resumes remaining time; at 0 → auto-submit (`autoSubmitted: true`).
- **Skip-ahead**: Opening Day N with Day N−1 incomplete shows a dismissible notice, never blocks.
- **Day 1**: `orientation` replaces `recap`.
