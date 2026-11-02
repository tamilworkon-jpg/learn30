# Research: AWS AI Practitioner 30-Day Course Website

**Feature**: 001-aws-ai-practitioner-course | **Date**: 2026-11-02

This document resolves all unknowns from the plan's Technical Context and records the comprehensive content analysis (source courses vs. the live official exam guide).

---

## Part A — Exam & Content Analysis (live research)

### A1. Official exam facts (verified 2026-11-02)

Sources:
- Exam guide: https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html
- Revisions: https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/aif-01-revisions.html
- Certification page: https://aws.amazon.com/certification/certified-ai-practitioner/

| Item | Value |
|------|-------|
| Exam code | AIF-C01 |
| Exam guide version | **1.2, published 2026-10-29** (1.0: 2026-03-26, 1.1: 2026-04-30). AWS states guide updates are reflected on the exam ~1 month after publication (≈ end of Nov 2026). |
| Questions | 65 total = 50 scored + 15 unscored (unidentified) |
| Duration | 90 minutes |
| Scoring | Scaled 100–1000, pass = 700, compensatory (no per-domain pass needed) |
| Question types | Multiple choice (1 of 4), Multiple response (2+ of 5+), Ordering (3–5 items), Matching (3–7 prompts). No penalty for guessing. |
| Cost / delivery | USD 100; Pearson VUE test centre or online proctored |
| Validity | 3 years |
| Candidate | Up to 6 months exposure to AI/ML on AWS; *uses* but does not necessarily *build* AI/ML solutions |

**Decision**: Course targets guide v1.2. Every lesson shows `examGuideVersion: 1.2` and `lastVerified` date.
**Rationale**: User requires latest content; v1.2 will be live on the exam during/after the 30-day study window.
**Alternatives considered**: Targeting v1.1 (rejected — will be superseded within the study window).

### A2. Domains, weights, task statements (v1.2)

| Domain | Weight | Task statements |
|--------|--------|-----------------|
| D1 Fundamentals of AI and ML | 20% | 1.1 AI concepts & terminology (incl. **agentic AI**, inference types: batch/real-time/async/serverless); 1.2 Practical use cases (when AI is *not* appropriate, traditional ML vs FM choice, AWS managed AI services); 1.3 AI/ML development lifecycle (pipeline, FM sources, production methods, MLOps, model & business metrics, services incl. **Amazon Quick, Kiro, SageMaker AI**) |
| D2 Fundamentals of GenAI | 24% | 2.1 GenAI concepts (tokens, chunking, embeddings, vectors, transformers, FMs, multimodal, diffusion, FM lifecycle, **token-based pricing**, **context engineering**, **agentic AI: multi-agent patterns, MCP, memory, tool use, orchestration**); 2.2 Capabilities/limitations & business metrics; 2.3 AWS GenAI infrastructure (Bedrock, SageMaker AI, JumpStart, **Amazon Quick, Kiro, Strands Agents, Bedrock AgentCore**) & cost trade-offs (provisioned throughput, custom models, regional coverage) |
| D3 Applications of FMs | 28% | 3.1 Design considerations (selection criteria incl. **prompt caching**, inference params, RAG/Knowledge Bases, vector stores: OpenSearch, Aurora, Neptune, RDS for PostgreSQL, customization cost trade-offs incl. **distillation**, AI agents); 3.2 Prompt engineering (constructs, zero/single/few-shot, CoT, templates, risks: exposure, poisoning, hijacking, jailbreaking, **Bedrock Prompt Management**); 3.3 Training & fine-tuning (pre-training, fine-tuning, continuous pre-training, distillation, instruction tuning, RLHF, data prep); 3.4 Evaluation (human-in-the-loop, benchmarks, Bedrock Model Evaluation, ROUGE, BLEU, BERTScore, **LLM-as-a-judge**, evaluating RAG/agents/workflows, business alignment metrics) |
| D4 Responsible AI | 14% | 4.1 Responsible AI development (bias, fairness, inclusivity, robustness, safety, veracity; Bedrock Guardrails; sustainable model selection; legal risks; dataset characteristics; bias/variance; detection tools: label quality, human audits, subgroup analysis); 4.2 Transparency & explainability (SageMaker Model Cards, Bedrock Model Evaluations, open source/licensing, safety vs transparency trade-offs, human-centred design) |
| D5 Security, Compliance & Governance | 14% | 5.1 Securing AI (IAM, encryption, Macie, PrivateLink, shared responsibility, **AgentCore Identity, Policy in AgentCore**, Guardrails; data lineage/cataloging, Model Cards; secure data engineering; prompt injection, output filtering, audit logging, toxicity; **hallucination detection & grounding, confidence scoring**); 5.2 Governance & compliance (Config, Inspector, Artifact, CloudTrail, Trusted Advisor; data lifecycle/residency/retention; **Generative AI Security Scoping Matrix**, review cadence, training) |

### A3. In-scope services (v1.2, non-exhaustive)

- **ML**: Amazon Bedrock, Bedrock AgentCore, Comprehend, Lex, **Amazon Nova**, Personalize, Polly, Rekognition, SageMaker AI, SageMaker JumpStart, Textract, Transcribe, Translate, **AWS Transform**
- **Developer tools**: **Kiro**, **Strands Agents**
- **Analytics**: Data Exchange, EMR, Glue, Glue DataBrew, Lake Formation, OpenSearch Service, **Amazon Quick**, Redshift
- **Database**: Aurora, DocumentDB, DynamoDB, ElastiCache, Neptune, RDS
- **Compute/Containers**: EC2, Lambda, ECS, EKS
- **Mgmt & governance**: CloudTrail, CloudWatch, Config, Trusted Advisor, Well-Architected Tool
- **Security**: Artifact, IAM, Inspector, KMS, Macie, Secrets Manager
- **Networking**: CloudFront, VPC (PrivateLink appears in task 5.1)
- **Cost**: Budgets, Cost Explorer
- **Storage**: S3, S3 Glacier

**Explicitly out of scope (relevant traps)**: AWS WAF, GuardDuty, Security Hub, Shield, Cognito, Detective, Control Tower, HealthImaging, HealthOmics.

### A4. Gap analysis — provided courses vs. guide v1.2

| Source | Keep (exam-relevant) | Reduce to background | Outdated / incorrect for v1.2 | Missing entirely |
|--------|----------------------|----------------------|-------------------------------|------------------|
| Udemy "Mastering AI: Basics to AWS AIP" (7/2025) | AI history/definitions, supervised/unsupervised/RL, clustering, PCA, NN/CNN/RNN, generative models, transfer learning, SageMaker, Comprehend, Lex, Polly, Rekognition, prompt engineering intro, ethics | Logic & reasoning, search algorithms, knowledge representation, distance measures, association rule learning, RL sub-types | **AWS DeepLens** (discontinued, not in scope) | Bedrock (all features), agentic AI/MCP/AgentCore/Strands, RAG & vector DBs, evaluation metrics, governance/security services, cost model |
| Skill Builder AIP Learning Plan (8 courses) | Nearly all objectives align to D1–D5 | — | **AWS WAF** (security course) now out of scope; **Amazon Q** branding superseded in guide by **Amazon Quick** / **Kiro**; Amazon A2I not listed (keep as concept "human review", low priority) | Agentic AI (MCP, multi-agent), AgentCore Identity/Policy, Strands, Kiro, Nova, AWS Transform, Prompt Management, context engineering, LLM-as-a-judge, distillation, prompt caching, Generative AI Security Scoping Matrix, hallucination grounding/confidence scoring |

**Decision**: Course content = union of both sources, filtered and re-weighted by guide v1.2; the "Missing entirely" column becomes dedicated lessons; outdated items appear only in "Exam Trap" callouts (e.g., "WAF is out of scope", "DeepLens is discontinued").
**Rationale**: Maximises exam yield per study hour; protects learner from studying stale material.
**Alternatives considered**: Following Udemy section order (rejected — ~25% of time on low-yield classical AI theory, misses ~30% of v1.2 objectives).

### A5. Final 30-day curriculum (task-statement mapped)

Core = ~60 min (Recap 5 · Concepts 25 · Diagrams/examples 10 · Read-through lab 8 · Exam tips 2 · Quiz 10). Architect Deep Dive is extra.

| Day | Title | Task stmts | Source alignment |
|-----|-------|-----------|------------------|
| 1 | Orientation: exam v1.2, study system; AI vs ML vs DL vs GenAI vs Agentic AI | 1.1 | Udemy S1 "Definition & History"; SB Fundamentals |
| 2 | Core ML vocabulary: model, algorithm, training vs inference, fit/over/underfit, bias–variance; inference types (batch, real-time, async, serverless) | 1.1, 4.1 | Udemy S3 intro; SB Fundamentals |
| 3 | Data types & learning types: labeled/unlabeled, tabular/time-series/image/text; supervised (regression, classification), unsupervised (clustering, PCA, association), RL, self-supervised | 1.1, 1.2 | Udemy S3 (all); SB Fundamentals |
| 4 | Neural networks & deep learning: neurons/layers, CNN (CV), RNN (sequence), transformers, transfer learning; CV & NLP | 1.1 | Udemy S4; SB Fundamentals |
| 5 | Use cases & choosing AI: value drivers, when NOT to use AI, regression vs classification vs clustering, traditional ML vs FM; managed AI services (Comprehend, Transcribe, Translate, Lex, Polly, Rekognition, Textract, Personalize) | 1.2 | SB Use Cases; Udemy S5 services |
| 6 | ML lifecycle & MLOps: pipeline stages, data services (S3, Glue, DataBrew, EMR, Lake Formation, Redshift, Data Exchange), SageMaker AI (Canvas, Data Wrangler, Feature Store, Ground Truth, JumpStart, Pipelines, Model Registry, Model Monitor), FM sources, deploy via managed API vs self-hosted; metrics (accuracy, precision, recall, F1, AUC, RMSE/MAE) & business metrics | 1.3 | SB ML Lifecycle; Udemy S5 SageMaker |
| 7 | **Week 1 Review** — concept map D1, cumulative test (57 Q) | D1 | — |
| 8 | GenAI building blocks: tokens, chunking, embeddings, vectors & similarity, transformer LLMs, FMs, multimodal, diffusion | 2.1 | SB Fundamentals (GenAI); Udemy "Generative Models" |
| 9 | FM lifecycle & economics: data → model selection → pre-training → fine-tuning → evaluation → deployment → feedback; GenAI use cases; token-based pricing; context engineering | 2.1 | SB Developing GenAI Solutions |
| 10 | Agentic AI: agents, tools, memory, planning/orchestration, multi-agent patterns, MCP | 2.1, 3.1 | SB Developing GenAI / Optimizing FMs (agents) + guide v1.2 |
| 11 | GenAI capabilities vs limitations: hallucination, nondeterminism, interpretability; model-selection factors; business value metrics (ROI, conversion, ARPU, CLV, efficiency) | 2.2 | SB Use Cases |
| 12 | AWS GenAI stack: Bedrock (model catalogue, Nova), SageMaker AI & JumpStart, Amazon Quick, Kiro, Strands Agents, Bedrock AgentCore, AWS Transform; why AWS (security, compliance, speed to market) | 2.3 | SB Developing GenAI + guide v1.2 |
| 13 | GenAI cost trade-offs: on-demand vs batch vs provisioned throughput, custom-model hosting, prompt caching, regional availability/redundancy, Budgets & Cost Explorer | 2.3, 3.1 | SB Developing GenAI |
| 14 | **Week 2 Review** — concept map D1–D2, cumulative test (57 Q) | D1–D2 | — |
| 15 | FM design decisions: selection criteria (cost, modality, latency, multilingual, size, context length, customization, prompt caching); inference parameters (temperature, top-p, top-k, max tokens, stop sequences); customization spectrum (ICL → RAG → fine-tune → distillation → pre-train) | 3.1 | SB Developing GenAI; SB Optimizing FMs |
| 16 | Prompt engineering I: context/instruction/input/output indicator, negative prompts, zero/single/few-shot, CoT, templates, best practices, Bedrock Prompt Management | 3.2 | SB Essentials of Prompt Engineering; Udemy "Prompt Engineering" |
| 17 | Prompt engineering II — risks & defences: injection, hijacking, jailbreaking, poisoning, exposure/leakage; Guardrails & output filtering | 3.2, 5.1 | SB Essentials of Prompt Engineering |
| 18 | RAG & vector stores: Bedrock Knowledge Bases, chunking strategies, embeddings, OpenSearch, Aurora/RDS for PostgreSQL (pgvector), Neptune, DocumentDB; Bedrock Agents & AgentCore in multi-step tasks | 3.1 | SB Optimizing FMs |
| 19 | Training & fine-tuning: pre-training, fine-tuning, continued pre-training, instruction tuning, domain adaptation, transfer learning, distillation, RLHF; data prep (curation, governance, size, labelling, representativeness) | 3.3 | SB Optimizing FMs; Udemy "Transfer Learning & Fine Tuning" |
| 20 | Evaluating FMs & FM apps: human-in-the-loop, benchmark datasets, Bedrock Model Evaluation, ROUGE/BLEU/BERTScore, LLM-as-a-judge; evaluating RAG/agents/workflows; business alignment metrics | 3.4 | SB Developing GenAI; SB Optimizing FMs |
| 21 | **Week 3 Review** — concept map D1–D3, cumulative test (57 Q) | D1–D3 | — |
| 22 | Responsible AI dimensions: bias, fairness, inclusivity, robustness, safety, veracity; dataset characteristics; bias/variance effects on groups; legal risks (IP, biased outputs, trust, hallucination) | 4.1 | SB Responsible AI; Udemy "AI Ethics" |
| 23 | Responsible AI tooling: Bedrock Guardrails, SageMaker Clarify, Model Monitor, human review (A2I concept), label-quality analysis, human audits, subgroup analysis; sustainable model selection | 4.1 | SB Responsible AI |
| 24 | Transparency & explainability: transparent vs opaque models, SageMaker Model Cards, Bedrock Model Evaluations, open-source & licensing, interpretability vs performance, human-centred design for XAI | 4.2 | SB Responsible AI |
| 25 | Securing AI systems: shared responsibility, IAM roles/policies, KMS & encryption in transit/at rest, VPC & PrivateLink, Macie, Secrets Manager, AgentCore Identity & Policy, Guardrails, prompt-injection defence, output validation, audit logging, toxicity | 5.1 | SB Security, Compliance & Governance |
| 26 | Secure data engineering & grounding: data quality, privacy-enhancing tech, access control, integrity; data lineage & cataloguing (Glue Data Catalog, Lake Formation), Model Cards as source citation; hallucination detection, RAG grounding, confidence scoring | 5.1 | SB Security, Compliance & Governance + guide v1.2 |
| 27 | Governance & compliance: Config, Inspector, Artifact, CloudTrail, CloudWatch, Trusted Advisor, Well-Architected Tool; data lifecycle, residency, retention, monitoring; Generative AI Security Scoping Matrix; review cadence & training | 5.2 | SB Security, Compliance & Governance |
| 28 | **Week 4 Review** — concept map D1–D5, cumulative test (57 Q) | D1–D5 | — |
| 29 | **Mock Exam 1** (65 Q / 90 min) + domain-targeted remediation | All | — |
| 30 | **Mock Exam 2** + final revision sheets + exam-day strategy; **Mock Exam 3** optional retake | All | — |

**Domain time check**: D1 ≈ 6 days, D2 ≈ 6 days, D3 ≈ 7 days (incl. Day 10/13 overlap), D4 ≈ 3 days, D5 ≈ 3.5 days → proportional to 20/24/28/14/14.

### A6. Question bank sizing

| Set | Count | Total |
|-----|-------|-------|
| Daily quizzes (24 lesson days: 1–6, 8–13, 15–20, 22–27) | 20 each | 480 |
| Weekly reviews (4) | 57 each, new questions, domain-weighted over covered domains | 228 |
| Mock exams (3) | 65 each, weighted 13/16/18/9/9 per D1–D5 | 195 |
| **Total unique** | | **903** (≥ 900, SC-003) |

Format mix target per set: ~70% multiple choice, ~20% multiple response, ~10% ordering/matching.
Weekly sets are 55–60 (target 57); daily sets 15–20 (target 20). Validator fails the build if the total drops below 900.
Mock scoring: all 65 scored in simulation; displayed scaled score = `100 + 900 × correct/65`, pass ≥ 700 (≈ 67%); readiness target ≥ 80% (SC-005).

---

## Part B — Technical decisions

### B1. Site architecture

- **Decision**: Static site generator **Astro 5** with **MDX** content collections, **Preact** islands for interactive components (quiz, mock exam, dashboard), **Tailwind CSS v4** for the colourful theme.
- **Rationale**: Content-heavy (30 long lessons, 900+ questions) → content-first SSG; Astro content collections give build-time schema validation (Zod) to enforce FR-005/FR-011 counts; islands keep pages fast; output is plain static files that run locally and through VS Code port forwarding with no backend (FR-024, FR-025).
- **Alternatives**: Docusaurus/VitePress (docs-style look, harder custom dashboard/mock UX); Next.js (heavier, server features unneeded); hand-written HTML (no validation, poor authoring at this scale).

### B2. Diagrams

- **Decision**: **Mermaid** diagrams authored inline in MDX, rendered client-side from the bundled `mermaid` npm package (no CDN), plus hand-authored SVG for console read-through "screenshots"/annotated mock-ups.
- **Rationale**: Text-based diagrams are versionable and quick to author for ~60+ diagrams; bundling keeps it offline-capable. Real AWS console screenshots are avoided (copyright, drift) in favour of annotated SVG mock-ups dated with `asOf`.
- **Alternatives**: Build-time rendering via headless browser (adds Playwright to build); image-only diagrams (not editable).

### B3. Search

- **Decision**: **Pagefind** static search index generated post-build over lessons, glossary and cheat sheets.
- **Rationale**: Zero-backend, fast, works offline/local; satisfies FR-020 and SC-006.
- **Alternatives**: Fuse.js client index (manual indexing, larger bundle); Algolia (external hosting, out of scope).

### B4. Progress persistence

- **Decision**: Browser `localStorage`, single versioned key `aip-course:v1`, JSON document defined in [contracts/progress-schema.json](contracts/progress-schema.json); export/import as `.json` file validated against the same schema.
- **Rationale**: Single learner, no login (FR-024); per-origin storage means localhost and forwarded URL hold separate progress → export/import bridges them (spec edge case).
- **Alternatives**: IndexedDB (unneeded complexity at <100 KB); a local backend (violates static-only simplicity).

### B5. Serving locally & port forwarding

- **Decision**: `npm run build` → `npm run preview -- --host` (or `npm run dev -- --host`) on port 4321; all internal links root-relative with `base: '/'`; no absolute host URLs.
- **Rationale**: VS Code port forwarding maps the forwarded URL root to the local port, so root-relative links work unchanged.

### B6. Testing & content validation

- **Decision**:
  - Content schema validation: Astro content collections (Zod) at build.
  - Coverage/consistency script `npm run validate:content`: every v1.2 task statement mapped (SC-001, ≥3 questions each), question counts per set, unique question IDs, no mock question reused, each lesson has required sections + ≥1 diagram + real-world block + deep dive (SC-002a, SC-007), every question has per-option explanations (FR-012).
  - Unit tests (**Vitest**): scoring, scaled score, domain breakdown, progress store migrations, export/import validation, streak logic.
  - E2E smoke (**Playwright**): resume flow, quiz submit, mock timer auto-submit, mobile viewport.
- **Rationale**: The biggest risk is content incompleteness, so it is validated mechanically.

### B7. Accessibility & theme

- **Decision**: Domain colour system (D1 blue, D2 purple, D3 orange, D4 green, D5 red) with WCAG AA contrast; callout components (Tip, Exam Trap, Real-world, Hands-on, Remember, Deep Dive); light/dark toggle; keyboard-operable quizzes; diagrams carry a text caption.
- **Rationale**: FR-021–FR-023, SC-008.

### B8. Content currency process

- **Decision**: `src/data/exam-guide.yaml` stores guide version, publication date, task statements, in/out-of-scope services. Each lesson frontmatter carries `lastVerified`. The validator warns if a lesson references a service on the out-of-scope list without an `examTrap` flag.
- **Rationale**: FR-004 and the "exam guide changes" edge case.

### B9. Visual design reference (Figma)

- **Decision**: Use Figma Community "Online Learning Platform (2019)" (EduEra) as the visual reference: purple app shell + white rounded content panel, sidebar nav with tab-style active item, gradient course cards with orange pills, right-hand lessons list with orange numbered icons. Sampled tokens `#503E9D`, `#6553B2`, `#FB6D3A`, `#FDA484`, `#F6F6F5`, `#FFFFFF`; Poppins self-hosted via `@fontsource/poppins`. Captures stored in `design/figma-*.png`.
- **Rationale**: Friendly, colourful, course-platform look requested by the learner; maps 1:1 to our dashboard and lesson pages.
- **Adaptations**: white-on-orange fails AA (≈2.9:1) → dark text on orange or `#C2410C` for white text; mobile and dark theme derived (file is desktop/light only); photos replaced with own diagrams; domain colours limited to chips/accents inside the white panel.
- **Alternatives considered**: in-repo design without reference (rejected — learner supplied a preferred design).
