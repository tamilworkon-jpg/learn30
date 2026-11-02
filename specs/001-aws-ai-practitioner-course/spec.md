# Feature Specification: AWS AI Practitioner 30-Day Course Website

**Feature Branch**: `001-aws-ai-practitioner-course`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Create a comprehensive 1-month AI learning guide (1 hour per day) to clear the AWS Certified AI Practitioner certification, delivered as a colourful, user-friendly, Udemy-style course website. Content must be analysed from the provided Udemy course ('Mastering AI: Basics to AWS Certified AI Practitioner') and the AWS Skill Builder AI Practitioner Learning Plan (Fundamentals of ML & AI, Exploring AI Use Cases, Responsible AI, ML Lifecycle/MLOps, Developing GenAI Solutions, Optimizing Foundation Models, Security/Compliance/Governance, Essentials of Prompt Engineering), verified against the latest official AWS exam guide. Each day needs a recap of the previous day, detailed explanations, examples, real-world examples, hands-on practice, diagrams, and an end-of-day test. Each week needs a cumulative review. The site must remember progress so the learner resumes where they left off."

## Overview

A self-paced, single-learner study website that turns the official AWS Certified AI Practitioner exam scope into a 30-day programme of ~60-minute daily lessons. The learner opens the site, sees exactly which day they are on, studies a structured lesson (recap → concepts → diagrams → examples → real-world scenario → hands-on → quiz), and ends with exam-style mock tests. The site is the "proper guide website" for the certification and the single place to revise later.

### Content Scope (analysis of sources vs. official exam)

The curriculum MUST map to the current official AWS Certified AI Practitioner exam guide domains. At the time of writing (exam code AIF-C01) these are:

| Domain | Weight | Primary source coverage |
|--------|--------|-------------------------|
| D1 – Fundamentals of AI and ML | 20% | Udemy Sections 1–4; Skill Builder "Fundamentals of ML & AI", "Exploring AI Use Cases", "ML Lifecycle / MLOps" |
| D2 – Fundamentals of Generative AI | 24% | Udemy "Generative Models", "Foundation Models"; Skill Builder "Fundamentals" (GenAI part), "Exploring AI Use Cases" |
| D3 – Applications of Foundation Models | 28% | Skill Builder "Developing GenAI Solutions", "Optimizing Foundation Models", "Essentials of Prompt Engineering"; Udemy "Prompt Engineering" |
| D4 – Guidelines for Responsible AI | 14% | Skill Builder "Responsible AI Practices"; Udemy "AI Ethics" |
| D5 – Security, Compliance, and Governance for AI Solutions | 14% | Skill Builder "Security, Compliance, and Governance for AI Solutions" |

Gap analysis findings that the curriculum MUST address:

- The Udemy course is weighted toward classical AI theory (search algorithms, logic, knowledge representation, association rules, RL variants) that carries little exam weight; these topics are covered briefly as background only.
- The Udemy course references AWS DeepLens, which AWS has discontinued; it MUST be flagged as legacy and not taught as exam content.
- Exam-critical topics under-covered by the source courses MUST receive dedicated lessons (authoritative list: [research.md](research.md) A2/A3, exam guide v1.2): Amazon Bedrock (model catalogue incl. Amazon Nova, Knowledge Bases, Agents, Guardrails, Model Evaluation, Prompt Management, on-demand vs. batch vs. provisioned throughput, prompt caching), agentic AI (agents, tools, memory, orchestration, multi-agent patterns, MCP), Amazon Bedrock AgentCore (incl. Identity and Policy), Strands Agents, Kiro, Amazon Quick, AWS Transform, SageMaker AI capabilities (Canvas, JumpStart, Data Wrangler, Feature Store, Model Monitor, Clarify, Model Cards, Ground Truth, Pipelines, Model Registry), RAG and vector stores (OpenSearch Service, Aurora/RDS for PostgreSQL, Neptune, DocumentDB, DynamoDB), customization (fine-tuning, continued pre-training, distillation, RLHF), inference parameters, context engineering, evaluation (ROUGE, BLEU, BERTScore, LLM-as-a-judge, accuracy, precision, recall, F1, AUC, RMSE), prompt attacks (injection, hijacking, jailbreaking, poisoning, exposure), hallucination grounding, security and governance services (IAM, KMS, Macie, Secrets Manager, PrivateLink, VPC, CloudTrail, CloudWatch, Config, Inspector, Artifact, Trusted Advisor, Well-Architected Tool), the Generative AI Security Scoping Matrix, shared responsibility model, and cost trade-offs.
- AWS managed AI services MUST be covered with "which service for which use case" framing for the v1.2 in-scope services: Comprehend, Rekognition, Textract, Transcribe, Polly, Translate, Lex, Personalize.
- Services not in the v1.2 in-scope list (e.g., AWS WAF, GuardDuty, Amazon Kendra, Amazon Q, Amazon A2I, Audit Manager, Forecast, Fraud Detector, HealthScribe, PartyRock, DeepLens) MUST appear only as "Exam Trap" or "Beyond the exam" notes, never as exam content.

## Clarifications

### Session 2026-11-02

- Q: Where will the course website be opened and used? → A: Locally on this computer, served so it can be shared via VS Code port forwarding; public hosting is out of scope for now.
- Q: Will the learner use an AWS account for hands-on labs? → A: No AWS account; all hands-on labs are guided read-throughs with screenshots/diagrams.
- Q: How large and deep should the content and question bank be? → A: Extensive, architect-level depth: build from scratch to detailed end-to-end understanding; 15–20 questions/day, ~50 per weekly review, 3 full mock exams (~900 questions total). (Weekly later set to 55–60 so the total reaches ≥ 900.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Follow a daily 1-hour lesson (Priority: P1)

The learner opens the site, picks the current day (e.g., Day 5), and works through a single lesson designed for ~60 minutes: a recap of the previous day, learning objectives, detailed but plain-language explanations, at least one diagram, simple examples, a real-world AWS scenario, a hands-on activity, and key exam tips.

**Why this priority**: The daily lesson is the core value; without it nothing else matters.

**Independent Test**: Open any single day's lesson and confirm all required sections are present, readable, and completable in roughly one hour.

**Acceptance Scenarios**:

1. **Given** the learner is on Day N (N > 1), **When** they open the lesson, **Then** the first section is a recap summarising Day N−1's key points.
2. **Given** a lesson is open, **When** the learner scrolls through it, **Then** they see, in order: Recap, Objectives, Explanation, Diagram(s), Examples, Real-world scenario, Hands-on practice, Exam tips, Daily quiz.
3. **Given** a lesson, **When** the estimated time per section is summed, **Then** it totals 50–70 minutes.

---

### User Story 2 - Take the end-of-day test and see results (Priority: P1)

After studying, the learner takes a short exam-style quiz for that day, gets an immediate score, and sees an explanation for every answer (why correct, why other options are wrong).

**Why this priority**: Active recall and exam-style practice are essential to passing the certification.

**Independent Test**: Complete any day's quiz and verify scoring, per-question explanations, and the ability to retry.

**Acceptance Scenarios**:

1. **Given** a daily quiz, **When** the learner submits answers, **Then** a score is shown and each question shows the correct answer plus an explanation.
2. **Given** a quiz was completed, **When** the learner returns later, **Then** their best score for that day is shown.
3. **Given** the quiz, **When** questions are displayed, **Then** they use exam formats (single-answer, multiple-response, and where suitable ordering/matching).

---

### User Story 3 - Resume where I left off (Priority: P1)

When the learner returns to the site, it remembers completed days, quiz scores, and the last section viewed, and offers a "Continue where you left off" action.

**Why this priority**: Explicitly requested; prevents restarting from Day 1.

**Independent Test**: Complete part of Day 3, close the site, reopen it, and confirm it offers to resume at the exact section in Day 3.

**Acceptance Scenarios**:

1. **Given** the learner completed Days 1–2 and part of Day 3, **When** they reopen the site, **Then** the home page shows 2 days complete, Day 3 in progress, and a "Continue" button to the last section.
2. **Given** progress exists, **When** the learner marks a day complete, **Then** overall course progress (%) updates immediately.
3. **Given** the learner wants a fresh start, **When** they choose "Reset progress" and confirm, **Then** all progress is cleared.

---

### User Story 4 - Weekly cumulative review (Priority: P2)

At the end of each week (Days 7, 14, 21, 28) the learner gets a review day consolidating everything learned so far: a summary sheet of all prior topics, a concept map diagram, and a longer cumulative test drawing from all previous days.

**Why this priority**: Spaced review significantly improves retention but depends on daily content existing first.

**Independent Test**: Open the Week 2 review and confirm it covers Days 1–13 topics and its test includes questions from both weeks.

**Acceptance Scenarios**:

1. **Given** the Week N review, **When** opened, **Then** it summarises all topics from Day 1 to the current day, grouped by exam domain.
2. **Given** the weekly test, **When** completed, **Then** results are broken down by exam domain showing weak areas with links back to the relevant days.

---

### User Story 5 - Full mock exams and exam readiness (Priority: P2)

In the final days, the learner takes full-length timed mock exams that mirror the real exam (question count, time limit, domain weighting, scaled pass mark) and receives a readiness report.

**Why this priority**: Directly validates exam readiness.

**Independent Test**: Start a mock exam, let the timer run, submit, and confirm domain-weighted scoring and a pass/fail indication against the official passing score.

**Acceptance Scenarios**:

1. **Given** a mock exam, **When** started, **Then** it has the same number of questions and time limit as the official exam, with questions distributed per domain weights.
2. **Given** a completed mock, **When** results are shown, **Then** the learner sees overall score, per-domain score, pass/fail versus the official pass mark, and links to review incorrect topics.
3. **Given** the learner flags questions during the mock, **When** they reach the end, **Then** they can review flagged questions before submitting.

---

### User Story 6 - Quick revision and lookup (Priority: P2)

The learner can quickly revisit any topic via a course outline, search, a glossary of key terms, an "AWS service → use case" cheat sheet, and a one-page summary per day.

**Why this priority**: Supports "easy to go back and remember what was done".

**Independent Test**: Search for "Bedrock Guardrails" and confirm results link to the correct lesson section, glossary entry, and cheat-sheet row.

**Acceptance Scenarios**:

1. **Given** any page, **When** the learner searches a term, **Then** matching lessons, glossary entries, and cheat-sheet items are shown.
2. **Given** the cheat sheet, **When** viewed, **Then** every AWS service in scope is listed with a one-line purpose and a typical exam-scenario cue.

---

### User Story 7 - Engaging, colourful experience (Priority: P3)

The site looks modern, friendly, and colourful, with visual progress (progress bars, streaks, badges per week completed), callout boxes (tip, warning, exam trap, real-world), and is comfortable to use on desktop and mobile.

**Why this priority**: Requested to prevent boredom; enhances but does not block learning.

**Independent Test**: Review a lesson on desktop and phone width; confirm colour-coded callouts, readable layout, and visible progress indicators.

**Acceptance Scenarios**:

1. **Given** the learner completes 7 consecutive days, **When** viewing the dashboard, **Then** a streak counter and a week-complete badge are shown.
2. **Given** a phone-sized screen, **When** viewing a lesson, **Then** content, diagrams, and quizzes are fully usable without horizontal scrolling.

### Edge Cases

- Learner skips ahead (e.g., opens Day 10 before Day 9): allowed, with a gentle note that Day 9 is incomplete; recap still shows Day 9 content.
- Learner misses days: the dashboard shows the next incomplete day, not a calendar date, so the plan never "expires".
- Day 1 has no previous day: recap section is replaced by a "Course orientation & exam overview".
- Learner clears browser data or switches device: progress is lost unless exported; an export/import progress option is offered.
- Learner opens the site via the forwarded port URL instead of localhost: progress is stored separately per address, so export/import is used to carry progress between them.
- Mock exam timer reaches zero: exam auto-submits and unanswered questions count as incorrect.
- Learner navigates away mid-quiz: in-progress answers are retained when they return.
- AWS changes the exam guide (new version/domains): content includes a visible "Exam guide version and last verified date" so outdated material is identifiable.
- AWS console screens change over time: each guided read-through notes the date its screenshots/diagrams reflect, and focuses on concepts and options rather than exact button positions.

## Requirements *(mandatory)*

### Functional Requirements

**Curriculum & content**

- **FR-001**: The course MUST contain 30 days of content, each designed for approximately 60 minutes of study.
- **FR-002**: Every exam domain and every task statement in the current official AWS Certified AI Practitioner exam guide MUST be mapped to at least one day; a coverage matrix (task statement → day) MUST be visible to the learner.
- **FR-003**: Study time per domain MUST be roughly proportional to official domain weights (D3 receiving the most time).
- **FR-004**: Content MUST be verified against the latest AWS official sources (exam guide, Skill Builder learning plan, service documentation) and each lesson MUST show a "last verified" date; discontinued services (e.g., DeepLens) MUST be marked as legacy/not on the exam.
- **FR-005**: Each daily lesson MUST include: previous-day recap (or orientation on Day 1), learning objectives, detailed plain-language explanation that builds from first principles to detail, at least one diagram, simple examples, at least one real-world/industry scenario, a hands-on activity, exam tips/common traps, a one-paragraph summary, and a daily quiz.
- **FR-005a**: Each daily lesson MUST include an optional "Architect Deep Dive" section (outside the 60-minute core) explaining the end-to-end architecture of the day's topic: how components and AWS services fit together, data flow, design trade-offs (cost, latency, accuracy, security), and an end-to-end architecture diagram.
- **FR-006**: Each hands-on activity MUST be a guided read-through requiring no AWS account: it MUST state the goal, walk step-by-step through the relevant AWS console/service flow using annotated screenshots or diagrams, show the expected outcome, and end with 2–3 "what would you choose?" scenario checks. No step may require the learner to create AWS resources or incur cost.
- **FR-007**: Days 7, 14, 21, and 28 MUST be cumulative review days covering all content from Day 1 to that point, including a concept-map diagram and a cumulative test.
- **FR-008**: The final days (29–30) MUST include three full-length mock exams (Mock 1 on Day 29, Mock 2 on Day 30, Mock 3 as an optional final retake) plus a final revision and exam-day strategy guide (registration, format, time management, question types).
- **FR-009**: The course MUST include a glossary of key terms, an "AWS service → use case" cheat sheet, and a metrics cheat sheet (classification, regression, and generative AI evaluation metrics).
- **FR-010**: The course MUST cite the source materials that each day aligns with (Udemy lecture names and/or Skill Builder course names) so the learner can optionally watch the matching video.

**Assessment**

- **FR-011**: Each daily quiz MUST contain 15–20 exam-style questions; each weekly test MUST contain 55–60 questions; each of the 3 mock exams MUST match the official exam's question count and duration, and mock exams MUST NOT reuse daily/weekly questions.
- **FR-012**: Every question MUST have an explanation of the correct answer and why each distractor is wrong, and MUST be tagged with its exam domain.
- **FR-013**: Questions MUST include single-answer and multiple-response formats, and ordering/matching formats where appropriate.
- **FR-014**: Results MUST show score, per-domain breakdown (weekly/mock), and links to the lesson sections for missed questions.
- **FR-015**: Mock exams MUST support a countdown timer, flagging questions for review, a review screen before submit, and auto-submit on timeout.

**Progress & navigation**

- **FR-016**: The system MUST persist, per learner on their device, completed days, last viewed day and section, quiz/test/mock scores (best and latest), and in-progress quiz answers.
- **FR-017**: The home dashboard MUST show overall % complete, current day, a "Continue where you left off" action, streak, badges, and weak domains based on quiz results.
- **FR-018**: Learners MUST be able to mark a day complete, navigate to any day freely, and reset all progress with confirmation.
- **FR-019**: Learners MUST be able to export and import their progress as a file.
- **FR-020**: The site MUST provide a course outline (weeks → days → sections) and full-text search across lessons, glossary, and cheat sheets.

**Experience**

- **FR-021**: The visual design MUST be colourful and friendly, with colour-coded callouts (Tip, Exam Trap, Real-world, Hands-on, Remember), progress visuals, and per-domain colour coding used consistently.
- **FR-022**: The site MUST be usable on desktop, tablet, and mobile screen sizes.
- **FR-023**: The site MUST meet basic accessibility expectations: readable contrast, keyboard navigation, alt text/captions for diagrams.
- **FR-024**: The site MUST work for a single learner without account creation or login.
- **FR-025**: The site MUST run locally on the learner's computer with a single start step and MUST work correctly when accessed through a VS Code forwarded port URL (e.g., from a phone); no dependency on external hosting is allowed.
- **FR-026**: At the end of each weekly review day the site MUST ask the learner for an optional 1–5 engagement rating and store it with their progress; the dashboard MUST show the latest rating.

### 30-Day Outline (authoritative day-by-day plan: [research.md](research.md) A5)

Days 1–6, 8–13, 15–20, 22–27 are the 24 lesson days; Days 7, 14, 21, 28 are review days; Days 29–30 are mock days.

| Week | Days | Focus |
|------|------|-------|
| 1 | 1–6, Review 7 | Orientation & exam v1.2; AI/ML/DL/GenAI/agentic AI; ML vocabulary, bias–variance, inference types; data & learning types; neural networks, CNN, RNN, transformers; use cases & managed AI services; ML lifecycle, MLOps & metrics |
| 2 | 8–13, Review 14 | GenAI building blocks; FM lifecycle, token pricing & context engineering; agentic AI & MCP; GenAI capabilities/limitations & business metrics; AWS GenAI stack (Bedrock, Nova, SageMaker AI, JumpStart, Amazon Quick, Kiro, Strands Agents, AgentCore, AWS Transform); cost trade-offs |
| 3 | 15–20, Review 21 | FM selection & inference parameters; prompt engineering & Prompt Management; prompt risks & defences; RAG & vector stores; training, fine-tuning & distillation; FM evaluation incl. LLM-as-a-judge |
| 4 | 22–27, Review 28 | Responsible AI dimensions & legal risks; responsible AI tooling (Guardrails, Clarify, Model Monitor); transparency & explainability (Model Cards); securing AI systems (IAM, KMS, PrivateLink, Macie, AgentCore Identity/Policy); secure data engineering & hallucination grounding; governance & compliance (Config, Inspector, Artifact, CloudTrail, Trusted Advisor, Generative AI Security Scoping Matrix) |
| 5 | 29–30 | Mock exam 1 + targeted remediation; Mock exam 2 + final revision & exam-day strategy; optional Mock exam 3 final retake |

### Key Entities

- **Course**: The 30-day programme; has weeks, exam-guide version, last-verified date.
- **Week**: Groups days; ends with a review day and a badge.
- **Day/Lesson**: Day number, title, exam domains covered, source references, ordered sections, estimated time, summary.
- **Section**: Type (recap, objectives, explanation, diagram, example, real-world, hands-on, exam tips, summary, architect deep dive), content, estimated minutes, optional flag.
- **Question**: Prompt, format, options, correct answer(s), explanation, domain tag, linked lesson section.
- **Assessment**: Daily quiz, weekly test, or mock exam; set of questions, time limit (mock), pass mark.
- **Learner Progress**: Completed days, last position, attempts and scores, streak, badges, in-progress answers.
- **Glossary Term / Service Card**: Term or AWS service, definition/purpose, exam cue, linked lessons.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of task statements in the current official exam guide are mapped to at least one lesson and at least 3 practice questions.
- **SC-002**: Each daily lesson core (content + quiz, excluding the optional Architect Deep Dive) can be completed in 50–70 minutes by a beginner.
- **SC-002a**: 24/24 lesson days include an Architect Deep Dive with an end-to-end architecture diagram.
- **SC-003**: The question bank contains at least 900 unique exam-style questions (daily, weekly, and 3 mocks combined), each with an explanation.
- **SC-004**: A returning learner reaches their last-viewed section in 1 click from the home page in 100% of cases on the same device.
- **SC-005**: A learner who completes all 30 days scores at least 80% on the final mock exam (official pass threshold is 700/1000) before booking the real exam.
- **SC-006**: Any topic can be located via search or outline within 10 seconds.
- **SC-007**: Every lesson day includes at least one diagram and one real-world scenario (24/24), and every review day includes a concept-map diagram (4/4).
- **SC-008**: The learner's Week 1 engagement rating (FR-026) is ≥ 4/5.

## Assumptions

- The site runs locally (optionally shared via VS Code port forwarding); public hosting/deployment is out of scope for this feature and will be decided later.
- Single learner, self-study; no accounts, instructors, or multi-user features. Progress is stored on the learner's device with export/import as the portability mechanism.
- The target exam is AIF-C01 exam guide **v1.2 (published 2026-10-29, verified 2026-11-02)**; it adds agentic AI/MCP, Bedrock AgentCore, Strands Agents, Kiro, Amazon Quick, Nova, and moves AWS WAF out of scope — see [research.md](research.md) for the authoritative scope. Format (65 questions — 50 scored, 15 unscored — 90 minutes, scaled score 100–1000, pass mark 700). If AWS has published a newer version by build time, the newer guide takes precedence and the outline is adjusted.
- Content is original and written in the course's own words, aligned with (not copied from) the Udemy and AWS Skill Builder materials; those courses are referenced, not reproduced.
- Live research of official AWS sources (exam guide, Skill Builder, service docs, what's-new) is performed while authoring content to ensure currency.
- The learner has basic computer literacy; no programming and no AWS account are required.
- All hands-on labs are guided read-throughs; real AWS console labs are out of scope.
- Language is English, written in simple, clear terms for beginners.
- Studying 1 hour/day, 30 days; missed days simply shift the schedule.
