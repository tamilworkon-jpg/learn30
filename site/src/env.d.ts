declare module '*.yaml?raw' {
  const content: string;
  export default content;
}

declare namespace App {
  interface Locals {
    /** Learn30: id of the course the page belongs to (set by course pages, read via lib/course-locals). */
    courseId?: string;
  }
}
