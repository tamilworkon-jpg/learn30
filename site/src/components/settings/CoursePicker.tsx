// Learn30 — which course's progress the settings below apply to. With one course it is just a label.
import { chooseCourse, useChosenCourse } from './course-choice';

export interface CourseOption {
  id: string;
  title: string;
}

export default function CoursePicker({ courses }: { courses: CourseOption[] }) {
  const ids = courses.map((c) => c.id);
  const id = useChosenCourse(ids);
  if (courses.length <= 1) {
    return (
      <p class="settings-course m-0" data-settings-course={id}>
        Course: <strong>{courses[0]?.title}</strong>
      </p>
    );
  }
  return (
    <label class="settings-course flex flex-col text-sm font-medium" data-settings-course={id}>
      Course
      <select class="schedule-input" value={id} onChange={(e) => chooseCourse((e.target as HTMLSelectElement).value)} data-course-picker>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </label>
  );
}
