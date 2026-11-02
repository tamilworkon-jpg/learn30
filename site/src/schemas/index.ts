import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import lessonSchema from './lesson-frontmatter.schema.json';
import progressSchema from './progress-schema.json';
import questionSchema from './question.schema.json';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export const validateQuestion = ajv.compile(questionSchema);
export const validateLesson = ajv.compile(lessonSchema);
export const validateProgress = ajv.compile(progressSchema);

export function errorText(errors: typeof validateProgress.errors): string {
  return (errors ?? []).map((e) => `${e.instancePath || '(root)'} ${e.message}`).join('; ');
}
