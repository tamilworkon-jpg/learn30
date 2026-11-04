// T205 — site structure: the course catalogue is the outer layer (`/`); each course has its own
// dashboard. The AWS AI Practitioner course's other pages keep their routes (/day/NN, /outline, …).
export const CATALOGUE_HREF = '/';
export const COURSE_ID = 'aws-ai-practitioner';
export const DASHBOARD_HREF = `/course/${COURSE_ID}`;
