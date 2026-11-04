# Contract — a course folder

```
site/src/data/courses.yaml                      # registry entry (id, title, shortTitle, provider, examCode, …)
site/src/courses/<id>/course.yaml               # modules (topic groups), days, badges
site/src/courses/<id>/exam-guide.yaml           # official guide: domains, task statements, in/out-of-scope services
site/src/courses/<id>/rules.yaml                # CourseRules (mock size/minutes/pass/count, mockSplit, mockLaunches, sizes)
site/src/courses/<id>/metrics.ts                # optional cheat-sheet data
site/src/content/lessons/<id>/day-NN.mdx
site/src/content/questions/<id>/<set>.yaml      # day-NN, week-N, mock-N
site/src/content/glossary/<id>/*.yaml
site/src/content/services/<id>/*.yaml
```

- Collection entry ids are `<id>/<local-id>`; loaders expose `courseId` on each entry.
- `getCourse(id)` (site/src/lib/course-data.ts) → `{ meta, course, examGuide, rules }` + `lessonsOf(id)`, `questionsOf(id)`, `glossaryOf(id)`, `servicesOf(id)` helpers.
- `scripts/validate-content.ts` validates every available course with its own rules.
- Fixture courses for tests: `site/tests/fixtures/courses/<id>/…` (same layout), included only when `AIP_FIXTURE_COURSES=1` (e2e build).
