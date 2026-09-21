import { nowIso, q } from '../db/index.js';
import { newId, round } from '../lib/http.js';
import { getStudentSkills } from './adaptive.js';
import { listAttempts } from './assessment.js';
import { listCoursesForStudent } from './content.js';
import type { ProgressStatus, ProgressSummary, LessonSummary } from '@shared/types';

export function logActivity(userId: string, kind: string, refId: string | null, at = nowIso()): void {
  q.run('INSERT INTO activity_log (user_id, kind, ref_id, created_at) VALUES (?, ?, ?, ?)', userId, kind, refId, at);
}

export function addPoints(studentId: string, points: number, at = nowIso()): void {
  q.run('UPDATE student_profiles SET points = points + ?, last_active_at = ? WHERE user_id = ?', points, at, studentId);
}

export function touchLessonProgress(
  studentId: string,
  lessonId: string,
  status: ProgressStatus,
  at = nowIso(),
  percent?: number,
): { status: ProgressStatus; percent: number; completedNow: boolean; pointsAwarded: number } {
  const existing = q.get<{ id: string; status: ProgressStatus; percent: number }>(
    'SELECT id, status, percent FROM progress WHERE student_id = ? AND lesson_id = ?',
    studentId,
    lessonId,
  );
  const targetStatus: ProgressStatus = existing?.status === 'completed' ? 'completed' : status;
  const targetPercent = targetStatus === 'completed' ? 100 : Math.max(existing?.percent ?? 0, percent ?? 10);
  const completedNow = targetStatus === 'completed' && existing?.status !== 'completed';
  if (!existing) {
    q.run(
      'INSERT INTO progress (id, student_id, lesson_id, status, percent, time_spent_min, last_accessed_at, completed_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
      newId('prg'),
      studentId,
      lessonId,
      targetStatus,
      targetPercent,
      at,
      targetStatus === 'completed' ? at : null,
    );
  } else {
    q.run(
      'UPDATE progress SET status = ?, percent = ?, last_accessed_at = ?, completed_at = COALESCE(completed_at, ?) WHERE id = ?',
      targetStatus,
      targetPercent,
      at,
      targetStatus === 'completed' ? at : null,
      existing.id,
    );
  }
  if (completedNow) {
    addPoints(studentId, 10, at);
    logActivity(studentId, 'lesson_completed', lessonId, at);
  } else {
    q.run('UPDATE student_profiles SET last_active_at = ? WHERE user_id = ?', at, studentId);
  }
  return { status: targetStatus, percent: targetPercent, completedNow, pointsAwarded: completedNow ? 10 : 0 };
}

/** Streak = consecutive days (ending today or yesterday) with at least one logged activity. */
export function computeStreak(studentId: string, now = new Date()): number {
  const days = new Set(
    q
      .all<{ d: string }>('SELECT DISTINCT substr(created_at, 1, 10) AS d FROM activity_log WHERE user_id = ?', studentId)
      .map((r) => r.d),
  );
  let streak = 0;
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const today = cursor.toISOString().slice(0, 10);
  if (!days.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1); // allow "yesterday" to keep the streak alive
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function activitySeries(studentIds: string[], days = 14, now = new Date()): { date: string; lessons: number; attempts: number }[] {
  const start = new Date(now.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const placeholders = studentIds.map(() => '?').join(',') || "''";
  const rows = q.all<{ d: string; kind: string; n: number }>(
    `SELECT substr(created_at, 1, 10) AS d, kind, COUNT(*) AS n FROM activity_log
      WHERE user_id IN (${placeholders}) AND created_at >= ? GROUP BY d, kind`,
    ...studentIds,
    start,
  );
  const series: { date: string; lessons: number; attempts: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    const lessons = rows.filter((r) => r.d === date && r.kind === 'lesson_completed').reduce((a, r) => a + r.n, 0);
    const attempts = rows.filter((r) => r.d === date && r.kind === 'attempt').reduce((a, r) => a + r.n, 0);
    series.push({ date, lessons, attempts });
  }
  return series;
}

export function getProgressSummary(studentId: string): ProgressSummary {
  const courses = listCoursesForStudent(studentId);
  const lessonsTotal = q.count('SELECT COUNT(*) FROM lessons');
  const lessonsCompleted = q.count("SELECT COUNT(*) FROM progress WHERE student_id = ? AND status = 'completed'", studentId);
  const attempts = listAttempts(studentId, 8);
  const attemptsCount = q.count('SELECT COUNT(*) FROM attempts WHERE student_id = ?', studentId);
  const avg = q.get<{ avg: number | null }>('SELECT AVG(percent) AS avg FROM attempts WHERE student_id = ?', studentId)?.avg ?? null;
  const profile = q.get<{ points: number }>('SELECT points FROM student_profiles WHERE user_id = ?', studentId);
  const skills = getStudentSkills(studentId);
  const last = q.get<{
    id: string;
    module_id: string;
    title: string;
    summary: string;
    position: number;
    duration_min: number;
    status: ProgressStatus;
    percent: number;
    course_id: string;
    course_title: string;
  }>(
    `SELECT l.id, l.module_id, l.title, l.summary, l.position, l.duration_min, p.status, p.percent, c.id AS course_id, c.title AS course_title
       FROM progress p JOIN lessons l ON l.id = p.lesson_id JOIN modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id
      WHERE p.student_id = ? ORDER BY p.last_accessed_at DESC LIMIT 1`,
    studentId,
  );
  const weeklyMinutes = q.count(
    "SELECT COALESCE(SUM(l.duration_min), 0) FROM progress p JOIN lessons l ON l.id = p.lesson_id WHERE p.student_id = ? AND p.last_accessed_at >= ?",
    studentId,
    new Date(Date.now() - 7 * 86400000).toISOString(),
  );
  const lastLesson: (LessonSummary & { courseId: string; courseTitle: string }) | null = last
    ? {
        id: last.id,
        moduleId: last.module_id,
        title: last.title,
        summary: last.summary,
        position: last.position,
        durationMin: last.duration_min,
        status: last.status,
        percent: last.percent,
        courseId: last.course_id,
        courseTitle: last.course_title,
      }
    : null;
  return {
    lessonsCompleted,
    lessonsTotal,
    coursesInProgress: courses.filter((c) => (c.percent ?? 0) > 0 && (c.percent ?? 0) < 100).length,
    averageScore: avg === null ? null : round(avg, 0),
    attemptsCount,
    points: profile?.points ?? 0,
    streakDays: computeStreak(studentId),
    weeklyMinutes,
    lastLesson,
    courses,
    weakSkills: skills.filter((s) => s.level === 'weak').sort((a, b) => a.mastery - b.mastery).slice(0, 5),
    strongSkills: skills.filter((s) => s.level === 'strong').sort((a, b) => b.mastery - a.mastery).slice(0, 5),
    recentAttempts: attempts,
    activity: activitySeries([studentId]),
  };
}
