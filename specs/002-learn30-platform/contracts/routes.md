# Contract — routes (Learn30)

Helper: `site/src/lib/routes.ts` — `courseHref(id, page, arg?, hash?)`, `courseIdFromPath(path)`, `legacyCoursePath(path)`.

| Path | Page | Access |
|------|------|--------|
| `/` | Course catalogue | public |
| `/settings` | Account settings (theme, per-course start date / export / import / reset) | sign-in |
| `/login`, `/signup` | Auth | public (signed-in → `/`) |
| `/course/<id>` | Course dashboard | sign-in |
| `/course/<id>/day/NN` | Lesson / review / mock day | public |
| `/course/<id>/outline` | Outline | public |
| `/course/<id>/glossary` | Glossary | public |
| `/course/<id>/cheatsheet/<sheet>` | Cheat sheets | public |
| `/course/<id>/coverage` | Exam-guide coverage | public |
| `/course/<id>/search` | Search within the course | public |
| `/course/<id>/mock/N` | Mock exam | sign-in |

Legacy (301, query + hash preserved by the browser): `/courses` → `/`; `/day/NN`, `/outline`, `/mock/N`, `/glossary`, `/cheatsheet/*`, `/coverage`, `/search` → `/course/aws-ai-practitioner/<same>`.

Sign-in rule (server/access.ts): `/settings`, `/course/<id>` (exact), `/course/<id>/mock/*`. Everything else public. Protected pages redirect to `/login?next=<path>`.
