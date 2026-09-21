/**
 * Teacher / admin analytics computed directly from attempts, progress and skill tables.
 */
import { q } from '../db/index.js';
import { forbidden, notFound } from '../lib/errors.js';
import { round } from '../lib/http.js';
import { getStudentSkills } from './adaptive.js';
import { activitySeries, computeStreak } from './progress.js';
import { listAttempts } from './assessment.js';
import type { ClassRoom, StudentSkill } from '@shared/types';

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

export function listClassesForTeacher(teacherId: string): ClassRoom[] {
  return q
    .all<{ id: string; name: string; grade: number; teacher_id: string; join_code: string; student_count: number }>(
      `SELECT c.*, (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id) AS student_count FROM classes c WHERE c.teacher_id = ? ORDER BY c.grade, c.name`,
      teacherId,
    )
    .map((c) => ({ id: c.id, name: c.name, grade: c.grade, teacherId: c.teacher_id, joinCode: c.join_code, studentCount: c.student_count }));
}

export function listClassesForStudent(studentId: string): ClassRoom[] {
  return q
    .all<{ id: string; name: string; grade: number; teacher_id: string; join_code: string; student_count: number }>(
      `SELECT c.*, (SELECT COUNT(*) FROM class_students cs2 WHERE cs2.class_id = c.id) AS student_count FROM classes c JOIN class_students cs ON cs.class_id = c.id WHERE cs.student_id = ? ORDER BY c.name`,
      studentId,
    )
    .map((c) => ({ id: c.id, name: c.name, grade: c.grade, teacherId: c.teacher_id, joinCode: c.join_code, studentCount: c.student_count }));
}

export function assertTeacherOwnsClass(teacherId: string, classId: string, role: string): ClassRoom {
  const c = q.get<{ id: string; name: string; grade: number; teacher_id: string; join_code: string }>('SELECT * FROM classes WHERE id = ?', classId);
  if (!c) throw notFound('Class');
  if (role !== 'admin' && c.teacher_id !== teacherId) throw forbidden('You do not teach this class');
  return { id: c.id, name: c.name, grade: c.grade, teacherId: c.teacher_id, joinCode: c.join_code };
}

export function teacherCanSeeStudent(teacherId: string, studentId: string, role: string): boolean {
  if (role === 'admin') return true;
  return !!q.get('SELECT 1 FROM class_students cs JOIN classes c ON c.id = cs.class_id WHERE c.teacher_id = ? AND cs.student_id = ?', teacherId, studentId);
}

export function studentRow(studentId: string): StudentRow {
  const u = q.get<{ id: string; name: string; email: string; avatar_color: string; grade: number; points: number; last_active_at: string | null }>(
    'SELECT u.id, u.name, u.email, u.avatar_color, sp.grade, sp.points, sp.last_active_at FROM users u JOIN student_profiles sp ON sp.user_id = u.id WHERE u.id = ?',
    studentId,
  );
  if (!u) throw notFound('Student');
  const lessonsCompleted = q.count("SELECT COUNT(*) FROM progress WHERE student_id = ? AND status = 'completed'", studentId);
  const attempts = q.count('SELECT COUNT(*) FROM attempts WHERE student_id = ?', studentId);
  const avg = q.get<{ avg: number | null }>('SELECT AVG(percent) AS avg FROM attempts WHERE student_id = ?', studentId)?.avg ?? null;
  const lastActivity = q.get<{ at: string }>('SELECT MAX(created_at) AS at FROM activity_log WHERE user_id = ? AND kind != ?', studentId, 'seed')?.at ?? null;
  const weak = getStudentSkills(studentId).filter((s) => s.level === 'weak').sort((a, b) => a.mastery - b.mastery).slice(0, 3);
  const daysSince = lastActivity ? (Date.now() - new Date(lastActivity).getTime()) / 86400000 : Infinity;
  const risk: StudentRow['risk'] = daysSince > 7 ? 'inactive' : avg !== null && avg < 50 ? 'needs_support' : 'on_track';
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarColor: u.avatar_color,
    grade: u.grade,
    points: u.points,
    lessonsCompleted,
    attempts,
    averageScore: avg === null ? null : round(avg, 0),
    lastActiveAt: lastActivity,
    weakSkills: weak.map((w) => ({ id: w.id, name: w.name, mastery: w.mastery })),
    risk,
  };
}

export function classStudentIds(classId: string): string[] {
  return q.all<{ student_id: string }>('SELECT student_id FROM class_students WHERE class_id = ? ORDER BY student_id', classId).map((r) => r.student_id);
}

export interface ClassAnalytics {
  classroom: ClassRoom;
  students: StudentRow[];
  summary: {
    studentCount: number;
    averageScore: number | null;
    averageLessonsCompleted: number;
    activeLast7Days: number;
    atRisk: number;
    totalAttempts: number;
  };
  skillHeatmap: { skillId: string; skillName: string; subjectId: string; averageMastery: number | null; weakCount: number; assessed: number }[];
  weakAreas: { skillId: string; skillName: string; averageMastery: number; weakCount: number }[];
  scoreDistribution: { bucket: string; count: number }[];
  activity: { date: string; lessons: number; attempts: number }[];
  assignments: { id: string; title: string; type: string; dueAt: string | null; submissions: number }[];
}

export function classAnalytics(classroom: ClassRoom): ClassAnalytics {
  const ids = classStudentIds(classroom.id);
  const students = ids.map(studentRow);
  const placeholders = ids.map(() => '?').join(',') || "''";

  const skillRows = q.all<{ skill_id: string; skill_name: string; subject_id: string; avg_mastery: number | null; weak_count: number; assessed: number }>(
    `SELECT s.id AS skill_id, s.name AS skill_name, s.subject_id,
            AVG(ss.mastery) AS avg_mastery,
            SUM(CASE WHEN ss.mastery < 60 THEN 1 ELSE 0 END) AS weak_count,
            COUNT(ss.student_id) AS assessed
       FROM skills s
       LEFT JOIN student_skills ss ON ss.skill_id = s.id AND ss.student_id IN (${placeholders})
      GROUP BY s.id ORDER BY s.subject_id, s.name`,
    ...ids,
  );
  const skillHeatmap = skillRows.map((r) => ({
    skillId: r.skill_id,
    skillName: r.skill_name,
    subjectId: r.subject_id,
    averageMastery: r.avg_mastery === null ? null : round(r.avg_mastery, 0),
    weakCount: r.weak_count ?? 0,
    assessed: r.assessed,
  }));
  const weakAreas = skillHeatmap
    .filter((s) => s.assessed > 0 && (s.averageMastery ?? 100) < 60)
    .sort((a, b) => (a.averageMastery ?? 0) - (b.averageMastery ?? 0))
    .slice(0, 6)
    .map((s) => ({ skillId: s.skillId, skillName: s.skillName, averageMastery: s.averageMastery ?? 0, weakCount: s.weakCount }));

  const percents = q.all<{ percent: number }>(`SELECT percent FROM attempts WHERE student_id IN (${placeholders})`, ...ids).map((r) => r.percent);
  const buckets = ['0-39', '40-59', '60-79', '80-100'];
  const scoreDistribution = buckets.map((bucket) => {
    const [lo, hi] = bucket.split('-').map(Number);
    return { bucket, count: percents.filter((p) => p >= lo && p <= hi).length };
  });

  const scores = students.map((s) => s.averageScore).filter((s): s is number => s !== null);
  const weekAgo = Date.now() - 7 * 86400000;
  const assignments = q.all<{ id: string; title: string; type: string; due_at: string | null; submissions: number }>(
    'SELECT a.id, a.title, a.type, a.due_at, (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submissions FROM assignments a WHERE a.class_id = ? ORDER BY a.created_at DESC',
    classroom.id,
  );

  return {
    classroom: { ...classroom, studentCount: ids.length },
    students,
    summary: {
      studentCount: ids.length,
      averageScore: scores.length ? round(scores.reduce((a, b) => a + b, 0) / scores.length, 0) : null,
      averageLessonsCompleted: ids.length ? round(students.reduce((a, s) => a + s.lessonsCompleted, 0) / ids.length, 1) : 0,
      activeLast7Days: students.filter((s) => s.lastActiveAt && new Date(s.lastActiveAt).getTime() >= weekAgo).length,
      atRisk: students.filter((s) => s.risk !== 'on_track').length,
      totalAttempts: percents.length,
    },
    skillHeatmap,
    weakAreas,
    scoreDistribution,
    activity: activitySeries(ids),
    assignments: assignments.map((a) => ({ id: a.id, title: a.title, type: a.type, dueAt: a.due_at, submissions: a.submissions })),
  };
}

export function studentDetailForTeacher(studentId: string) {
  const row = studentRow(studentId);
  const skills: StudentSkill[] = getStudentSkills(studentId);
  const attempts = listAttempts(studentId, 10);
  const progress = q.all<{ lesson_id: string; lesson_title: string; course_title: string; status: string; percent: number; last_accessed_at: string }>(
    `SELECT p.lesson_id, l.title AS lesson_title, c.title AS course_title, p.status, p.percent, p.last_accessed_at
       FROM progress p JOIN lessons l ON l.id = p.lesson_id JOIN modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id
      WHERE p.student_id = ? ORDER BY p.last_accessed_at DESC LIMIT 20`,
    studentId,
  );
  const submissions = q.all<{ id: string; assignment_id: string; title: string; status: string; grade: number | null; submitted_at: string }>(
    'SELECT s.id, s.assignment_id, a.title, s.status, s.grade, s.submitted_at FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.student_id = ? ORDER BY s.submitted_at DESC',
    studentId,
  );
  return {
    student: row,
    streakDays: computeStreak(studentId),
    skills: skills.filter((s) => s.attemptsCount > 0).sort((a, b) => a.mastery - b.mastery),
    attempts,
    progress: progress.map((p) => ({ lessonId: p.lesson_id, lessonTitle: p.lesson_title, courseTitle: p.course_title, status: p.status, percent: p.percent, lastAccessedAt: p.last_accessed_at })),
    submissions: submissions.map((s) => ({ id: s.id, assignmentId: s.assignment_id, title: s.title, status: s.status, grade: s.grade, submittedAt: s.submitted_at })),
    activity: activitySeries([studentId]),
  };
}

export function teacherOverview(teacherId: string) {
  const classes = listClassesForTeacher(teacherId);
  const perClass = classes.map((c) => {
    const a = classAnalytics(c);
    return { classroom: a.classroom, summary: a.summary, weakAreas: a.weakAreas.slice(0, 3) };
  });
  const allIds = [...new Set(classes.flatMap((c) => classStudentIds(c.id)))];
  const pending = q.count(
    `SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.teacher_id = ? AND s.status = 'submitted'`,
    teacherId,
  );
  const recentSubmissions = q.all<{ id: string; student_name: string; title: string; submitted_at: string; status: string; assignment_id: string }>(
    `SELECT s.id, u.name AS student_name, a.title, s.submitted_at, s.status, s.assignment_id FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN users u ON u.id = s.student_id
      WHERE a.teacher_id = ? ORDER BY s.submitted_at DESC LIMIT 6`,
    teacherId,
  );
  return {
    classes: perClass,
    totals: {
      students: allIds.length,
      classes: classes.length,
      pendingGrading: pending,
      atRisk: perClass.reduce((a, c) => a + c.summary.atRisk, 0),
    },
    activity: activitySeries(allIds),
    recentSubmissions: recentSubmissions.map((s) => ({ id: s.id, studentName: s.student_name, title: s.title, submittedAt: s.submitted_at, status: s.status, assignmentId: s.assignment_id })),
  };
}

export function adminStats() {
  const count = (sql: string) => q.count(sql);
  return {
    users: {
      total: count('SELECT COUNT(*) FROM users'),
      students: count("SELECT COUNT(*) FROM users WHERE role = 'student'"),
      teachers: count("SELECT COUNT(*) FROM users WHERE role = 'teacher'"),
      admins: count("SELECT COUNT(*) FROM users WHERE role = 'admin'"),
    },
    content: {
      subjects: count('SELECT COUNT(*) FROM subjects'),
      courses: count('SELECT COUNT(*) FROM courses'),
      lessons: count('SELECT COUNT(*) FROM lessons'),
      questions: count('SELECT COUNT(*) FROM questions'),
      resources: count('SELECT COUNT(*) FROM learning_resources'),
      translations: count('SELECT COUNT(*) FROM lesson_translations'),
    },
    activity: {
      attempts: count('SELECT COUNT(*) FROM attempts'),
      lessonsCompleted: count("SELECT COUNT(*) FROM progress WHERE status = 'completed'"),
      aiMessages: count('SELECT COUNT(*) FROM ai_messages'),
      codeExecutions: count('SELECT COUNT(*) FROM code_executions'),
      projects: count('SELECT COUNT(*) FROM projects'),
      documents: count('SELECT COUNT(*) FROM documents'),
    },
  };
}
