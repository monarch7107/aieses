/**
 * AIESES shared domain types — imported by both the server and the client.
 * Keep this file dependency-free (plain TypeScript only).
 */

export type Role = 'student' | 'teacher' | 'admin';
export const ROLES: Role[] = ['student', 'teacher', 'admin'];

export type LanguageCode = 'en' | 'hi' | 'ta' | 'unr';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  /** available = UI + sample content; pilot = architecture wired, translation resources pending */
  status: 'available' | 'pilot';
  speechLocale?: string;
  note?: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', status: 'available', speechLocale: 'en-IN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', status: 'available', speechLocale: 'hi-IN' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', status: 'available', speechLocale: 'ta-IN' },
  {
    code: 'unr',
    name: 'Mundari',
    nativeName: 'Mundari',
    status: 'pilot',
    note: 'Pilot vernacular architecture: language is registered end-to-end, translation/speech resources are pending and content falls back to English. No machine-generated Mundari is fabricated.',
  },
];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  language: LanguageCode;
  avatarColor: string;
  createdAt: string;
  profile?: StudentProfile | TeacherProfile | null;
}

export interface StudentProfile {
  userId: string;
  grade: number;
  school: string;
  points: number;
  streakDays: number;
  bio?: string | null;
}

export interface TeacherProfile {
  userId: string;
  school: string;
  subjects: string[];
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  courseCount?: number;
}

export interface Course {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  grade: number;
  level: 'foundation' | 'intermediate' | 'advanced';
  estimatedHours: number;
  color: string;
  isPublished: boolean;
  lessonCount?: number;
  completedLessons?: number;
  percent?: number;
  subjectName?: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string;
  position: number;
  lessons?: LessonSummary[];
}

export interface LessonSummary {
  id: string;
  moduleId: string;
  title: string;
  summary: string;
  position: number;
  durationMin: number;
  status?: ProgressStatus;
  percent?: number;
}

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface Lesson extends LessonSummary {
  contentMd: string;
  keyPoints: string[];
  tutorNotes: TutorNotes;
  skills: Skill[];
  translation?: LessonTranslation | null;
  courseId: string;
  courseTitle: string;
  subjectId: string;
  subjectName: string;
  practiceAssessmentId?: string | null;
  resources?: LearningResource[];
  nextLessonId?: string | null;
  prevLessonId?: string | null;
}

export interface TutorNotes {
  simpler: string;
  example: string;
  misconceptions: string[];
  glossary: Record<string, string>;
}

export interface LessonTranslation {
  language: LanguageCode;
  title: string;
  summary: string;
  contentMd: string;
  keyPoints: string[];
  /** available = human-authored demo translation exists; fallback = English content returned */
  status: 'available' | 'fallback';
}

export interface Skill {
  id: string;
  subjectId: string;
  name: string;
  description: string;
}

export interface StudentSkill extends Skill {
  mastery: number; // 0-100
  attemptsCount: number;
  correctCount: number;
  lastUpdated: string | null;
  level: 'weak' | 'developing' | 'strong' | 'new';
}

export type ResourceType = 'video' | 'article' | 'interactive' | 'pdf' | 'diksha';

export interface LearningResource {
  id: string;
  title: string;
  type: ResourceType;
  url: string;
  source: string;
  subjectId: string | null;
  skillId: string | null;
  language: LanguageCode;
  description: string;
  isDemo: boolean;
  attribution: string;
  durationMin?: number | null;
}

export type QuestionType = 'mcq' | 'short';

export interface Question {
  id: string;
  lessonId: string | null;
  skillId: string;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  difficulty: 1 | 2 | 3;
  explanation?: string;
  points: number;
}

export interface Assessment {
  id: string;
  courseId: string | null;
  lessonId: string | null;
  title: string;
  description: string;
  type: 'practice' | 'quiz' | 'assignment';
  timeLimitMin: number | null;
  questions?: Question[];
  questionCount?: number;
  adaptiveLevel?: 'foundation' | 'intermediate' | 'advanced';
  adaptiveNote?: string;
}

export interface AttemptAnswer {
  questionId: string;
  answer: string | number | null;
}

export interface QuestionFeedback {
  questionId: string;
  prompt: string;
  skillId: string;
  skillName: string;
  correct: boolean;
  yourAnswer: string | null;
  correctAnswer: string;
  explanation: string;
  points: number;
  earned: number;
}

export interface SkillBreakdown {
  skillId: string;
  skillName: string;
  correct: number;
  total: number;
  percent: number;
  mastery: number;
  weak: boolean;
}

export interface Attempt {
  id: string;
  assessmentId: string;
  assessmentTitle?: string;
  studentId: string;
  startedAt: string;
  submittedAt: string | null;
  score: number;
  maxScore: number;
  percent: number;
  status: 'in_progress' | 'submitted';
  feedback?: QuestionFeedback[];
  skillBreakdown?: SkillBreakdown[];
  weakSkills?: SkillBreakdown[];
  recommendations?: Recommendation[];
  pointsEarned?: number;
}

export type RecommendationType = 'lesson' | 'resource' | 'practice' | 'diksha';

export interface Recommendation {
  id: string;
  studentId: string;
  type: RecommendationType;
  targetId: string;
  title: string;
  reason: string;
  priority: number;
  status: 'active' | 'done' | 'dismissed';
  skillId: string | null;
  skillName?: string | null;
  source: string;
  createdAt: string;
  href: string;
}

export interface ProgressSummary {
  lessonsCompleted: number;
  lessonsTotal: number;
  coursesInProgress: number;
  averageScore: number | null;
  attemptsCount: number;
  points: number;
  streakDays: number;
  weeklyMinutes: number;
  lastLesson: (LessonSummary & { courseId: string; courseTitle: string }) | null;
  courses: Course[];
  weakSkills: StudentSkill[];
  strongSkills: StudentSkill[];
  recentAttempts: Attempt[];
  activity: { date: string; lessons: number; attempts: number }[];
}

export interface ClassRoom {
  id: string;
  name: string;
  grade: number;
  teacherId: string;
  joinCode: string;
  studentCount?: number;
  subjectIds?: string[];
}

export interface Assignment {
  id: string;
  classId: string;
  className?: string;
  teacherId: string;
  title: string;
  description: string;
  type: 'assessment' | 'project';
  assessmentId: string | null;
  dueAt: string | null;
  createdAt: string;
  submissionCount?: number;
  mySubmission?: Submission | null;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName?: string;
  projectId: string | null;
  attemptId: string | null;
  content: string;
  status: 'submitted' | 'graded';
  grade: number | null;
  feedback: string | null;
  submittedAt: string;
}

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  type: 'document' | 'code' | 'mixed';
  classId: string | null;
  assignmentId: string | null;
  status: 'draft' | 'submitted';
  createdAt: string;
  updatedAt: string;
  documents?: DocumentSummary[];
  files?: FileSummary[];
}

export type DocumentFormat = 'markdown' | 'text' | 'richtext';

export interface DocumentSummary {
  id: string;
  projectId: string;
  ownerId: string;
  title: string;
  format: DocumentFormat;
  updatedAt: string;
  createdAt: string;
}

export interface Document extends DocumentSummary {
  content: string;
  language: LanguageCode;
}

export type CodeLanguage = 'javascript' | 'python' | 'c' | 'java';

export interface FileSummary {
  id: string;
  projectId: string;
  ownerId: string;
  name: string;
  language: CodeLanguage;
  size: number;
  updatedAt: string;
}

export interface CodeFile extends FileSummary {
  content: string;
}

export type ExecutionRunner = 'browser-worker' | 'pyodide-wasm' | 'simulated' | 'piston';

export interface ExecutionResult {
  id?: string;
  language: CodeLanguage;
  runner: ExecutionRunner;
  runnerLabel: string;
  simulated: boolean;
  status: 'success' | 'error' | 'timeout' | 'blocked';
  stdout: string;
  stderr: string;
  durationMs: number;
  note?: string;
}

export type TutorIntent = 'explain' | 'simpler' | 'example' | 'practice' | 'recommend' | 'general' | 'answer';

export interface AIMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  intent: TutorIntent | null;
  provider: string | null;
  createdAt: string;
  meta?: AIMessageMeta;
}

export interface AIMessageMeta {
  providerLabel?: string;
  safety?: { blocked: boolean; category?: string };
  practiceQuestion?: { questionId: string; prompt: string; options: string[] | null; skillName: string };
  recommendations?: Recommendation[];
  suggestions?: string[];
}

export interface AIConversation {
  id: string;
  userId: string;
  title: string;
  context: TutorContextRef;
  createdAt: string;
  messages?: AIMessage[];
}

export interface TutorContextRef {
  lessonId?: string | null;
  courseId?: string | null;
  subjectId?: string | null;
  language?: LanguageCode;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface DikshaResource {
  identifier: string;
  name: string;
  description: string;
  subject: string[];
  gradeLevel: string[];
  medium: string[];
  contentType: string;
  mimeType: string;
  url: string;
  attribution: string;
  isDemo: boolean;
  source: 'DIKSHA (DEMO DATA)' | 'DIKSHA';
}
