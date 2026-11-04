# Contract — progress API v2 (per course)

## Storage
- `progress(user_id, course_id, doc, updated_at)` — PRIMARY KEY (user_id, course_id).
- Migration (once, at server start, idempotent): old `progress(user_id PK, doc)` rows → `course_id = 'aws-ai-practitioner'`; `doc.settings.theme` copied to `ui_state.theme` when unset.
- `ui_state(user_id PK, doc)` — global UI: theme, lessonView, sidebar, sections, `slides["<courseId>:<day>"]`.

## Endpoints (JSON, session cookie, CSRF rules unchanged: `X-AIP-Request: 1` + JSON + Origin)
- `GET /api/courses/<id>/progress` → 200 Progress (default doc if none) · 404 unknown course · 401 signed out.
- `PUT /api/courses/<id>/progress` → 204 · 400 invalid · 413 too large.
- `GET /api/progress/summary` → `{ courses: { [id]: { completed: number, startedAt: string, lastPosition: {day, sectionId} | null, updatedAt } } }`.
- `GET|PUT /api/progress` → alias of `aws-ai-practitioner` (one release, then removed).
- `GET|PUT /api/ui` unchanged (+ `theme`).

## Bootstrap (`#aip-bootstrap`, injected per page)
`{ user, ui, course: { id, progress } | null, summary }` — `course` set on `/course/<id>/…` pages, `summary` on global pages.

## Client
- `getStore(courseId)`; the course id comes from `<html data-course>` (set by BaseLayout on course pages).
- Signed-out local keys: `aip-course:v2:<courseId>`; legacy `aip-course:v1` imports into the AWS course.
- `progress-schema.json` v2: `schemaVersion` 1 | 2; day keys `^[1-9][0-9]?$`, assessment ids `^(day-\d{2}|week-\d+|mock-\d+)$`, domain keys `^D\d+$`, badges free strings (validated in code against the course's `course.yaml`).
