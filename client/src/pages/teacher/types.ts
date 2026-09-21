import type { Attempt, ClassRoom, StudentSkill } from '@shared/types';

export interface StudentRow {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  grade: number;
  points: number;
  lessonsCompleted: number;
  attempts: number;
  averageScore: number | null;
  lastActiveAt: string | null;
  weakSkills: { id: string; name: string; mastery: number }[];
  risk: 'on_track' | 'needs_support' | 'inactive';
}

export interface ClassAnalytics {
  classroom: ClassRoom;
  students: StudentRow[];
  summary: { studentCount: number; averageScore: number | null; averageLessonsCompleted: number; activeLast7Days: number; atRisk: number; totalAttempts: number };
  skillHeatmap: { skillId: string; skillName: string; subjectId: string; averageMastery: number | null; weakCount: number; assessed: number }[];
  weakAreas: { skillId: string; skillName: string; averageMastery: number; weakCount: number }[];
  scoreDistribution: { bucket: string; count: number }[];
  activity: { date: string; lessons: number; attempts: number }[];
  assignments: { id: string; title: string; type: string; dueAt: string | null; submissions: number }[];
}

export interface TeacherOverview {
  classes: { classroom: ClassRoom; summary: ClassAnalytics['summary']; weakAreas: ClassAnalytics['weakAreas'] }[];
  totals: { students: number; classes: number; pendingGrading: number; atRisk: number };
  activity: { date: string; lessons: number; attempts: number }[];
  recentSubmissions: { id: string; studentName: string; title: string; submittedAt: string; status: string; assignmentId: string }[];
}

export interface StudentDetail {
  student: StudentRow;
  streakDays: number;
  skills: StudentSkill[];
  attempts: Attempt[];
  progress: { lessonId: string; lessonTitle: string; courseTitle: string; status: string; percent: number; lastAccessedAt: string }[];
  submissions: { id: string; assignmentId: string; title: string; status: string; grade: number | null; submittedAt: string }[];
  activity: { date: string; lessons: number; attempts: number }[];
}

export const riskTone: Record<StudentRow['risk'], { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  on_track: { tone: 'success', label: 'On track' },
  needs_support: { tone: 'warning', label: 'Needs support' },
  inactive: { tone: 'danger', label: 'Inactive' },
};
