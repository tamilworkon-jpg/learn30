# Test-only fixture courses (Learn30, spec 002)

`demo-course` proves the platform is multi-course. It is included **only** in e2e builds
(`AIP_FIXTURE_COURSES=1`, set by `npm run build:e2e` and the Playwright web server) and never ships.

Layout mirrors a real course (spec 002 contracts/course-folder.md):

```
registry.yaml                         # entries appended to src/data/courses.yaml in fixture builds
demo-course/course.yaml               # modules, days, badges
demo-course/exam-guide.yaml           # the course's guide (domains D1/D2, task statements 1.1–2.2)
demo-course/rules.yaml                # CourseRules (+ lessonMinutes / mockSections, see below)
demo-course/content/lessons/day-NN.mdx
demo-course/content/questions/<set>.yaml
demo-course/content/glossary/*.yaml
demo-course/content/services/*.yaml
```

Fixture courses skip the release-gate checks (lesson length 50–70 min, bank size), so the lessons are
short (about 20 minutes each); everything else — schemas, section order, lessonRefs, mock split from
`rules.yaml`, `mockSectionOrder` for day 3 — is validated like a real course.
Content is neutral study-skills material, not about any real certification.
