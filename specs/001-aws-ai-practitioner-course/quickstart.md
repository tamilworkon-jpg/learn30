# Quickstart & Validation Guide

## Prerequisites
- Node.js 22 LTS and npm
- VS Code (for optional port forwarding)

## Setup & run
```powershell
cd c:\LocalDrive\Learning\learn30\site
npm install
npm run validate:content   # content completeness & coverage checks
npm run build              # static build + Pagefind search index
npm run preview -- --host  # serves http://localhost:4321
```
Port forwarding: VS Code → **Ports** panel → Forward port `4321` → open the forwarded URL on phone/other device.

## Automated checks
```powershell
npm run test        # Vitest unit tests (scoring, progress store, import validation, streak)
npm run test:e2e    # Playwright smoke tests (desktop + mobile viewport)
```

## Validation scenarios

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| V1 | Content completeness | `npm run validate:content` | 0 errors: all v1.2 task statements mapped with ≥3 questions; 24 lesson days have all required sections, ≥1 diagram, real-world, deep dive; review days have a concept map; daily sets 15–20 Q, weekly 55–60, mocks 65 with split 13/16/18/9/9; ≥900 unique questions; no out-of-scope service taught without exam-trap flag ([data-model](data-model.md), [question schema](contracts/question.schema.json)) |
| V2 | Daily lesson flow (US1) | Open `/day/05` | Sections appear in order Recap → … → Quiz → Deep Dive; recap summarises Day 4; core time 50–70 min |
| V3 | Day 1 orientation | Open `/day/01` | Orientation shown instead of recap; exam facts match guide v1.2 |
| V4 | Daily quiz (US2) | Answer Day 5 quiz, submit | Score shown; every question shows correct answer + per-option explanation + lesson link; best score persists after reload |
| V5 | Resume (US3, SC-004) | Scroll to Day 3 `handsOn`, close tab, reopen `/` | Dashboard shows Days 1–2 complete, Day 3 in progress; "Continue" opens `/day/03#hands-on` in 1 click |
| V6 | In-progress quiz retention | Answer 5 questions, navigate away, return | Answers retained |
| V7 | Weekly review (US4) | Open `/day/14`, submit test | Summary covers Days 1–13 grouped by domain; per-domain results with links to weak days |
| V8 | Mock exam (US5) | Start `/mock/1`, flag 2 questions, open review, submit | 65 questions, 90:00 timer, review screen lists flags, scaled score + pass/fail at 700, domain breakdown |
| V9 | Mock timeout | In test mode set deadline to now+5s, reload | Auto-submits; unanswered count incorrect; `autoSubmitted` true |
| V10 | Search (US6, SC-006) | Search "Guardrails" | Results include lesson section(s), glossary term, service card |
| V11 | Export/import | Export on localhost, import on forwarded URL | Confirmation summary, progress identical; malformed/oversized file rejected with friendly message ([progress schema](contracts/progress-schema.json)) |
| V12 | Reset | Settings → Reset → confirm | All progress cleared |
| V13 | Mobile (US7) | Forwarded URL on phone or 375px viewport | No horizontal scroll; diagrams, quiz, mock usable |
| V14 | Engagement visuals | Complete Days 1–7 (test helper) | Streak 7, Week 1 badge shown |
| V15 | Accessibility | Keyboard-only through a quiz; run axe in Playwright | All controls reachable; no serious axe violations; diagrams have captions |
