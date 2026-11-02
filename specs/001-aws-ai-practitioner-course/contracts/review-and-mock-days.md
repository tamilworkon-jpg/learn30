# Contract: review-day and mock-day MDX (`kind: review`, `kind: mock`)

**Applies to**: `site/src/content/lessons/day-07.mdx`, `day-14.mdx`, `day-21.mdx`, `day-28.mdx` (`kind: review`) and `day-29.mdx`, `day-30.mdx` (`kind: mock`).
**Enforced by**: `npm run validate:content` (`checkReviewOrMockDay` in `site/src/lib/validate.ts`). Unit tests: `site/tests/unit/validate-content.test.ts` ("review and mock day structure").
**Rendered by**: `site/src/layouts/ReviewLayout.astro` and `site/src/layouts/MockDayLayout.astro` via `site/src/pages/day/[day].astro`.
**Reference examples** (they pass the validator, and the e2e tests render them): `site/tests/fixtures/days/day-07-review.mdx`, `day-29-mock.mdx`, `day-30-mock.mdx`. Copy one and replace the content.

Write only the parts listed below. The page adds everything else around your MDX. Do **not** add those parts yourself.

---

## 1. Frontmatter (both kinds)

Must be valid per [lesson-frontmatter.schema.json](lesson-frontmatter.schema.json). Extra rules:

| Field | Review day (7/14/21/28) | Mock day (29/30) |
|-------|-------------------------|------------------|
| `day` | 7, 14, 21 or 28 | 29 or 30 |
| `kind` | `review` (must match `course.yaml`) | `mock` (must match `course.yaml`) |
| `title` | e.g. `'Week 2 review'` (the page heading) | e.g. `'Mock exam 1 & remediation'` |
| `summary` | 1–2 sentences, ≤ 900 chars | same |
| `taskStatements` | **exactly** the day's list in `site/src/data/course.yaml` (any order) | **all 14**: `['1.1','1.2','1.3','2.1','2.2','2.3','3.1','3.2','3.3','3.4','4.1','4.2','5.1','5.2']`. `course.yaml` lists none for mock days on purpose. |
| `domains` | **exactly** the domains of those task statements (Day 7 → `[D1, D4]`, Day 14 → `[D1, D2]`, Day 21 → `[D2, D3]`, Day 28 → `[D4, D5]`) | `[D1, D2, D3, D4, D5]` |
| `objectives` | 3–7 strings | 3–7 strings |
| `estimatedMinutes` | 30–120. Use about `90` (about 30 min reading plus the 55–60 question test). | 30–120. Use `120` (90 min mock plus remediation). |
| `lastVerified` | `YYYY-MM-DD` | `YYYY-MM-DD` |
| `examTraps` | Needed for every out-of-scope or not-listed service you name (same rule as lessons). | same |
| `sources`, `deepDiveMinutes` | Leave them out. They are not used on these days. | Leave them out. |
| `keyPoints` | **Required in practice**: 3–8 one-line takeaways of the week. The next lesson day's Recap (Days 8, 15, 22) shows them, and TC-L L5 needs ≥ 3. | Optional (no lesson day follows). |

## 2. Body rules (both kinds)

- The body is made of `<Section id="…" type="…" title="…" minutes={N}>…</Section>` blocks. Use **exactly** the section types listed for the kind, in that order. Add no other sections. Do not mark any section `optional`.
- Use kebab-case section ids, all different. Use the recommended ids below, because `lessonRef` anchors and the page's links rely on them.
- Allowed components: `Section`, `Diagram`, `Callout`. Mock days may also use `MockLaunch` and `Remediation`. Any other component fails validation, for example `QuizSlot`, `HandsOnLab`, `Recap` or `Objectives`.
- Leave a blank line after `<Section …>` and another before `</Section>`, so Markdown lists and paragraphs render.
- `<Diagram caption="…" code={`…`} />` takes Mermaid code (rendered to SVG at build time). `npx tsx scripts/render-diagrams.ts` must succeed. The caption is the alt text, so make it describe the diagram (≥ 5 chars).
- `<Callout type="tip|examTrap|realWorld|remember">…</Callout>` works as it does in lessons.

---

## 3. `kind: review` (Days 7, 14, 21, 28)

### What the page adds (do not write these)
1. A breadcrumb, an `h1` from `title`, domain chips, and a "Review day · Days 1–N" pill.
2. **"What you have covered"** (`#summary`). This is generated from `course.yaml`: every lesson day before this day, grouped by exam domain, with links and the learner's daily-quiz average per domain (FR-007, W1).
3. **Your MDX**, described below.
4. **Cumulative test** (`#weekly-test`). The `QuizRunner` loads `site/src/content/questions/week-N.yaml` (`set: week-N`, kind `weekly`, 55–60 questions). Until that file exists, the page says "coming soon".
5. **Results by domain** (`#domain-results`). This shows a bar per domain for the latest attempt. Domains under 70% get a "Needs review" pill and "Revisit Day N" links to the lesson days of the questions missed in that domain. These links come from each question's `lessonRef`, so weekly questions must point `lessonRef` at the **lesson day that teaches the topic**, not at the review day.
6. **Engagement rating** (`#rating`, FR-026). It is saved to `progress.ratings.week-N`.
7. Previous/next navigation.

### Sections you write (exactly these, in this order)

| # | `type` | Recommended `id` | Required content (validated) | Guidance (not validated) |
|---|--------|------------------|------------------------------|--------------------------|
| 1 | `conceptMap` | `concept-map` | ≥ 1 `<Diagram>`: the week's concept map (SC-007, W2). | A Mermaid `mindmap` or `flowchart` linking **all** topics from Day 1 to this day, grouped by domain. Around 12–30 nodes. Add 1–2 sentences of intro. Reviews after week 1 may add a second diagram for the new week. |
| 2 | `topFacts` | `top-facts` | A **numbered** Markdown list (`1.` … ) with **≥ 20** items. | The 20 facts most likely to be tested, from Day 1 to now, weighted toward this week. One sentence each. End each with the source day, `(Day N)`. Use exam wording (service → use case, metric → meaning). |
| 3 | `traps` | `traps` | A Markdown list (`-` or `1.`) with **≥ 5** items. | Use the form `**"Tempting wrong idea"** — why it is wrong / what the exam wants.` Cover look-alike services, out-of-scope distractors and absolute wording. |

Suggested `minutes`: concept map 10, top facts 15, traps 5. The test adds about 1 minute per question.

### Complete minimal example (`day-07.mdx`)

```mdx
---
day: 7
kind: review
title: 'Week 1 review'
summary: 'Consolidate Week 1: the AI family tree, ML vocabulary, data and learning types, neural networks, AWS managed AI services and the ML lifecycle.'
domains: [D1, D4]
taskStatements: ['1.1', '1.2', '1.3', '4.1']
objectives:
  - 'Connect every Week 1 topic on one concept map'
  - 'Recall the 20 facts most likely to be tested'
  - 'Spot the classic Week 1 exam traps'
estimatedMinutes: 90
lastVerified: '2026-11-02'
---

<Section id="concept-map" type="conceptMap" title="Week 1 concept map" minutes={10}>

Everything from Days 1–6 on one map. Read it from the centre outwards and say each branch out loud.

<Diagram
  caption="Week 1 concept map: AI family, learning types, data, neural networks, AWS AI services and the ML lifecycle"
  code={`mindmap
  root((Week 1))
    AI family
      Machine learning
      Deep learning
      Generative AI
    Learning types
      Supervised
      Unsupervised
      Reinforcement
    Lifecycle
      Data prep
      Train and tune
      Deploy
      Monitor`}
/>

</Section>

<Section id="top-facts" type="topFacts" title="Top 20 facts" minutes={15}>

1. AI ⊃ machine learning ⊃ deep learning ⊃ generative AI (Day 1).
2. Machine learning learns patterns from data instead of following hand-written rules (Day 1).
3. … (one fact per line, through item 20)
20. Model drift means production data no longer matches training data, so monitor and retrain (Day 6).

</Section>

<Section id="traps" type="traps" title="Exam traps" minutes={5}>

- **"Deep learning is a separate field from ML"** — no: deep learning is a subset of machine learning.
- **"More training accuracy is always better"** — very high training accuracy with poor test accuracy is overfitting.
- **"Clustering needs labels"** — clustering is unsupervised; labels mean supervised learning.
- **"Batch inference for a chatbot"** — interactive, low-latency use cases need real-time inference.
- **"Accuracy is the best metric"** — on imbalanced data prefer precision, recall or F1.

</Section>
```

(The `3. …` line stands for items 3–19. A real file needs all 20 written out. The fixture `site/tests/fixtures/days/day-07-review.mdx` is the full version.)

### Weekly question set (`week-N.yaml`), for reference
Format per [question.schema.json](question.schema.json): ids `q-week-N-001`…, `set: week-N`, 55–60 questions (target 57). All questions must be new (no stem reused from daily sets). Weight them across every task statement from Day 1 to now. `lessonRef` must point to a lesson day section (see "Results by domain" above).

---

## 4. `kind: mock` (Days 29, 30)

### What the page adds (do not write these)
1. A breadcrumb, an `h1` from `title`, D1–D5 chips, and a "Mock day · 65 Q · 90 min" pill.
2. **Your MDX**, described below.
3. Previous/next navigation.

Without an MDX file, the page shows "coming soon" plus the launch cards for that day's mocks, so the mocks stay reachable.

### Components only for mock days

| Component | Usage | Renders |
|-----------|-------|---------|
| `<MockLaunch n={1} />` | inside `launch` | A card for Mock exam *n* (65 questions · 90 minutes · pass 700 on 100–1000), a **Start mock n →** link to `/mock/n`, and the learner's last attempt (scaled score, PASS/FAIL) or "in progress". It shows "Coming soon" while `mock-n.yaml` is missing. Add `optional` (`<MockLaunch n={3} optional />`) for the optional final retake. |
| `<Remediation mock={1} />` | inside `remediation` | Empty state before an attempt ("Take Mock exam 1 first"). After an attempt it lists the domains under 70%, weakest first, with score bars and "Revisit Day N" links (the lesson days of the missed questions, falling back to the domain's lesson days). |

### Sections you write (exactly these, in this order)

**Day 29** — `launch` → `remediation`

| `type` | Recommended `id` | Required content (validated) | Guidance |
|--------|------------------|------------------------------|----------|
| `launch` | `launch` | exactly `<MockLaunch n={1} />` | Exam-conditions briefing (one sitting, no notes, flag and review). An optional pacing `Callout type="tip"` (about 80 s per question, 10 min buffer). |
| `remediation` | `remediation` | `<Remediation mock={1} />` | Below the component, a numbered plan for the weak domains (re-read exam tips/summary of revisit days → retake those daily quizzes to 80%+ → weekly-review top facts and traps). Optionally a per-domain table of the most-tested services. |

**Day 30** — `launch` → `remediation` → `finalRevision` → `examStrategy`

| `type` | Recommended `id` | Required content (validated) | Guidance |
|--------|------------------|------------------------------|----------|
| `launch` | `launch` | `<MockLaunch n={2} />` then `<MockLaunch n={3} optional />` (in that order, nothing else) | Mock 2 today. Mock 3 is an optional retake later. Readiness target: ≥ 80% on the final mock (SC-005). |
| `remediation` | `remediation` | `<Remediation mock={2} />` | A short plan, as on Day 29. |
| `finalRevision` | `final-revision` | — | A final-pass checklist: the four weekly reviews' top facts and traps, plus each domain's weight (D1 20%, D2 24%, D3 28%, D4 14%, D5 14%). |
| `examStrategy` | `exam-strategy` | Must mention all of these: **registration** (the word "registration"/"register"), **Pearson VUE** (test centre or online proctoring), **90** (minutes), **65** (questions), the question types **multiple response**, **ordering** and **matching**, and **pacing** ("pace"/"pacing"). | Include scoring (100–1000, pass 700, 50 scored + 15 unscored). Also: what to bring / ID, the online-proctoring room check, and flag-and-return tactics. Use `exam-guide.yaml` for facts. |

### Complete minimal example (`day-29.mdx`)

```mdx
---
day: 29
kind: mock
title: 'Mock exam 1 & remediation'
summary: 'Sit a full 65-question, 90-minute mock under exam conditions, then turn your weakest domains into a focused remediation plan.'
domains: [D1, D2, D3, D4, D5]
taskStatements: ['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3', '3.4', '4.1', '4.2', '5.1', '5.2']
objectives:
  - 'Complete Mock exam 1 in one 90-minute sitting'
  - 'Read your scaled score and per-domain results'
  - 'Plan targeted remediation for every domain under 70%'
estimatedMinutes: 120
lastVerified: '2026-11-02'
---

<Section id="launch" type="launch" title="Mock exam 1" minutes={90}>

Treat this as the real exam: one sitting, no notes, phone away. Flag anything you are unsure about and use the review screen before you submit.

<MockLaunch n={1} />

<Callout type="tip">
Budget about 80 seconds per question and keep 10 minutes at the end for flagged questions.
</Callout>

</Section>

<Section id="remediation" type="remediation" title="Remediation plan" minutes={30}>

Your weakest domains appear below once you have submitted Mock 1. Work through them in order.

<Remediation mock={1} />

1. Re-read the exam tips and summary of every "Revisit Day" link above.
2. Retake the daily quiz of those days until you score 80% or more.
3. Re-read the top facts of the matching weekly review.

</Section>
```

### Complete minimal example (`day-30.mdx`)

```mdx
---
day: 30
kind: mock
title: 'Mock exam 2, final revision & exam day'
summary: 'Sit Mock exam 2 (and optionally Mock 3), close the last gaps and walk into the exam with a clear plan.'
domains: [D1, D2, D3, D4, D5]
taskStatements: ['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3', '3.4', '4.1', '4.2', '5.1', '5.2']
objectives:
  - 'Complete Mock exam 2 and compare it with Mock 1'
  - 'Close remaining gaps with a final revision pass'
  - 'Know the registration, delivery and pacing plan for exam day'
estimatedMinutes: 120
lastVerified: '2026-11-02'
---

<Section id="launch" type="launch" title="Mock exams 2 and 3" minutes={90}>

Mock 2 is today's main event. Mock 3 is an optional final retake for later in the week.

<MockLaunch n={2} />

<MockLaunch n={3} optional />

</Section>

<Section id="remediation" type="remediation" title="Remediation plan" minutes={10}>

<Remediation mock={2} />

</Section>

<Section id="final-revision" type="finalRevision" title="Final revision" minutes={10}>

- Re-read the top facts of all four weekly reviews.
- Re-read the exam traps of all four weekly reviews.

</Section>

<Section id="exam-strategy" type="examStrategy" title="Exam-day strategy" minutes={10}>

- **Registration**: book AIF-C01 through your AWS Certification account.
- **Delivery**: choose a Pearson VUE test centre or online proctoring.
- **Format**: 65 questions in 90 minutes; pass mark 700 on a 100–1000 scale.
- **Question types**: multiple choice, multiple response, ordering and matching.
- **Pacing**: about 80 seconds per question; flag and move on.

</Section>
```

### Mock question sets (`mock-1.yaml` … `mock-3.yaml`), for reference
Each set must contain **exactly 65** questions, with the domain split **13 / 16 / 18 / 9 / 9** (D1–D5) and all four question types. All questions must be new. Ids are `q-mock-N-001`…, with `set: mock-N`. `lessonRef` must point to the lesson day that teaches the topic. The runner at `/mock/N` uses the 90-minute clock, palette, flags, review screen and auto-submit. It reports a scaled score `100 + 900 × correct / 65` (pass ≥ 700), a per-domain breakdown, and readiness at ≥ 80%.

---

## 5. Validator messages (what each failure means)

| Message (prefix `Day N (file):`) | Fix |
|----------------------------------|-----|
| `sections must be exactly conceptMap → topFacts → traps (found …)` | Use exactly the listed `type`s, in that order. Add no others. |
| `review needs a concept-map diagram in the conceptMap section` | Add a `<Diagram … />` inside the `conceptMap` section. |
| `topFacts needs ≥ 20 numbered facts (found N)` | Use a `1.` … numbered list with at least 20 items. |
| `traps needs ≥ 5 list items (found N)` | Use at least 5 `-` items. |
| `components not allowed on review days: X` | Remove `X`. The page adds the test, results and rating itself. |
| `launch section must contain <MockLaunch n={…} /> for mock 1` (or `2 and 3`) | Day 29: `n={1}`. Day 30: `n={2}` then `n={3} optional`. |
| `remediation section must contain <Remediation mock={N} />` | Add the component. |
| `examStrategy must cover …` | Add the missing topic (see the Day 30 table). |
| `domains … must be the domains of its task statements` | Fix `domains` (see the table in §1). |
| `taskStatements … differ from course.yaml / all task statements` | Copy the list from `course.yaml` (review days) or use all 14 (mock days). |
