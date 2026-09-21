/**
 * EduNexus learning routes: subjects, courses, lessons, resources, skills, progress, recommendations.
 */
import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db/index.js';
import { forbidden, notFound } from '../lib/errors.js';
import { paramString, queryString, validate } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getCourseDetail, getLessonDetail, getResource, listCoursesForStudent, listResources, listSkills, listSubjects } from '../services/content.js';
import { getProgressSummary, logActivity, touchLessonProgress } from '../services/progress.js';
import { getRecommendations, getStudentSkills, regenerateRecommendations, setRecommendationStatus } from '../services/adaptive.js';
import { teacherCanSeeStudent } from '../services/analytics.js';
import { getDikshaAdapter } from '../services/diksha.js';
import type { LanguageCode } from '@shared/types';

export const learningRouter = Router();
learningRouter.use(requireAuth);

const langSchema = z.enum(['en', 'hi', 'ta', 'unr']);
function langOf(value: string | undefined, fallback: LanguageCode): LanguageCode {
  const parsed = langSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}
function userLanguage(userId: string): LanguageCode {
  return (q.get<{ language: LanguageCode }>('SELECT language FROM users WHERE id = ?', userId)?.language ?? 'en') as LanguageCode;
}
function studentIdFor(req: Parameters<typeof requireAuth>[0]): string | null {
  return req.session!.role === 'student' ? req.session!.sub : null;
}

// ---- Subjects & courses ------------------------------------------------------
learningRouter.get('/subjects', (_req, res) => res.json({ subjects: listSubjects() }));

learningRouter.get('/courses', (req, res) => {
  res.json({ courses: listCoursesForStudent(studentIdFor(req), queryString(req, 'subjectId')) });
});

learningRouter.get('/courses/:id', (req, res) => {
  res.json({ course: getCourseDetail(paramString(req, 'id'), studentIdFor(req)) });
});

// ---- Lessons -----------------------------------------------------------------
learningRouter.get('/lessons/:id', (req, res) => {
  const lang = langOf(queryString(req, 'lang'), userLanguage(req.session!.sub));
  const studentId = studentIdFor(req);
  const lesson = getLessonDetail(paramString(req, 'id'), studentId, lang);
  if (studentId) {
    touchLessonProgress(studentId, lesson.id, 'in_progress');
    logActivity(studentId, 'lesson_view', lesson.id);
  }
  res.json({ lesson });
});

learningRouter.post('/lessons/:id/progress', requireRole('student'), (req, res) => {
  const { status } = validate(z.object({ status: z.enum(['in_progress', 'completed']) }), req.body, 'progress');
  const lessonId = paramString(req, 'id');
  if (!q.get('SELECT 1 FROM lessons WHERE id = ?', lessonId)) throw notFound('Lesson');
  const result = touchLessonProgress(req.session!.sub, lessonId, status);
  let recommendations = getRecommendations(req.session!.sub);
  if (result.completedNow) recommendations = regenerateRecommendations(req.session!.sub);
  res.json({ progress: result, recommendations });
});

// ---- Resources ----------------------------------------------------------------
learningRouter.get('/resources', async (req, res) => {
  const query = queryString(req, 'q');
  const subjectId = queryString(req, 'subjectId');
  const skillId = queryString(req, 'skillId');
  const local = listResources({ query, subjectId, skillIds: skillId ? [skillId] : undefined });
  const includeDiksha = queryString(req, 'includeDiksha') !== 'false';
  const diksha = includeDiksha ? await getDikshaAdapter().search({ query, subject: subjectId, limit: 12 }) : null;
  res.json({ resources: local, diksha });
});

learningRouter.get('/resources/:id', (req, res) => {
  const resource = getResource(paramString(req, 'id'));
  if (!resource) throw notFound('Resource');
  if (req.session!.role === 'student') logActivity(req.session!.sub, 'resource_open', resource.id);
  res.json({ resource });
});

// ---- Skills, progress, recommendations ---------------------------------------
learningRouter.get('/skills', (req, res) => res.json({ skills: listSkills(queryString(req, 'subjectId')) }));

learningRouter.get('/skills/me', requireRole('student'), (req, res) => {
  res.json({ skills: getStudentSkills(req.session!.sub, queryString(req, 'subjectId')) });
});

learningRouter.get('/progress/me', requireRole('student'), (req, res) => {
  res.json({ progress: getProgressSummary(req.session!.sub) });
});

learningRouter.get('/progress/students/:id', requireRole('teacher', 'admin'), (req, res) => {
  const id = paramString(req, 'id');
  if (!teacherCanSeeStudent(req.session!.sub, id, req.session!.role)) throw forbidden('Student is not in one of your classes');
  res.json({ progress: getProgressSummary(id), skills: getStudentSkills(id) });
});

learningRouter.get('/recommendations/me', requireRole('student'), (req, res) => {
  const all = queryString(req, 'status') === 'all';
  res.json({ recommendations: getRecommendations(req.session!.sub, all ? 'all' : 'active') });
});

learningRouter.post('/recommendations/refresh', requireRole('student'), (req, res) => {
  res.json({ recommendations: regenerateRecommendations(req.session!.sub) });
});

learningRouter.post('/recommendations/:id/:action', requireRole('student'), (req, res) => {
  const action = validate(z.enum(['done', 'dismissed']), req.params.action, 'action');
  const ok = setRecommendationStatus(req.session!.sub, paramString(req, 'id'), action);
  if (!ok) throw notFound('Recommendation');
  res.json({ recommendations: getRecommendations(req.session!.sub) });
});
