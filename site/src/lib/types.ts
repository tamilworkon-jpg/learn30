export type DomainId = 'D1' | 'D2' | 'D3' | 'D4' | 'D5';

export interface TaskStatement {
  id: string;
  title: string;
  objectives: string[];
}
export interface Domain {
  id: DomainId;
  name: string;
  weight: number;
  color: string;
  tasks: TaskStatement[];
}
export interface ExamGuide {
  examCode: string;
  name: string;
  version: string;
  publishedOn: string;
  lastVerified: string;
  sourceUrl: string;
  format: { totalQuestions: number; scored: number; minutes: number; passScaled: number; scaleMin: number; scaleMax: number };
  questionTypes: string[];
  domains: Domain[];
  inScopeServices: string[];
  outOfScopeServices: string[];
  notListed: string[];
}

export type DayKind = 'lesson' | 'review' | 'mock';
export interface CourseDay {
  day: number;
  kind: DayKind;
  title: string;
  taskStatements: string[];
}
export interface Course {
  weeks: { number: number; title: string; days: [number, number]; badge: string }[];
  badges: string[];
  days: CourseDay[];
}

export type QuestionType = 'single' | 'multi' | 'ordering' | 'matching';
export type Answer = string[] | Record<string, string>;
export interface Question {
  id: string;
  set: string;
  type: QuestionType;
  stem: string;
  options: { id: string; text: string; explanation: string }[];
  matchTargets?: { id: string; text: string }[];
  answer: Answer;
  explanation: string;
  domain: DomainId;
  taskStatement: string;
  lessonRef: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Score {
  correct: number;
  total: number;
  percent: number;
  scaled?: number;
}
export type DomainScores = Partial<Record<DomainId, { correct: number; total: number }>>;

export interface Attempt {
  id: string;
  assessmentId: string;
  kind: 'daily' | 'weekly' | 'mock';
  startedAt: string;
  submittedAt: string;
  answers: Record<string, Answer>;
  flagged: string[];
  score: Score;
  byDomain: DomainScores;
  autoSubmitted: boolean;
}

export interface DayState {
  status: 'not-started' | 'in-progress' | 'completed';
  sectionsViewed: string[];
  completedAt?: string;
  bestScore?: number;
  latestScore?: number;
}

export interface InProgressAttempt {
  answers: Record<string, Answer>;
  flagged: string[];
  startedAt: string;
  deadline?: string;
}

export interface Progress {
  schemaVersion: 1;
  examGuideVersion: string;
  startedAt: string;
  lastPosition: { day: number; sectionId: string; updatedAt: string } | null;
  days: Record<string, DayState>;
  attempts: Attempt[];
  inProgress: Record<string, InProgressAttempt>;
  streak: { current: number; longest: number; lastStudyDate?: string };
  badges: string[];
  settings: { theme?: 'light' | 'dark' };
  ratings: Record<string, number>;
}
