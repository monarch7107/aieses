import { beforeAll, describe, expect, it } from 'vitest';
import { api, loginAs, type Session } from './helpers.js';

let student: Session;

beforeAll(async () => {
  student = await loginAs('student');
});

describe('courses & lessons', () => {
  it('lists subjects with course counts', async () => {
    const res = await api().get('/api/subjects').set('Cookie', student.cookie);
    expect(res.status).toBe(200);
    const ids = res.body.subjects.map((s: { id: string }) => s.id).sort();
    expect(ids).toEqual(['cs', 'math', 'science']);
    expect(res.body.subjects.every((s: { courseCount: number }) => s.courseCount >= 1)).toBe(true);
  });

  it('lists courses with per-student progress and filters by subject', async () => {
    const all = await api().get('/api/courses').set('Cookie', student.cookie);
    expect(all.status).toBe(200);
    expect(all.body.courses.length).toBeGreaterThanOrEqual(4);
    const math = await api().get('/api/courses?subjectId=math').set('Cookie', student.cookie);
    expect(math.body.courses.every((c: { subjectId: string }) => c.subjectId === 'math')).toBe(true);
    const fractions = all.body.courses.find((c: { id: string }) => c.id === 'course-math6-fractions');
    expect(fractions.lessonCount).toBe(7);
    expect(typeof fractions.percent).toBe('number');
  });

  it('returns course detail with modules, lessons, skills and quizzes', async () => {
    const res = await api().get('/api/courses/course-math6-fractions').set('Cookie', student.cookie);
    expect(res.status).toBe(200);
    const c = res.body.course;
    expect(c.modules.length).toBeGreaterThanOrEqual(2);
    const lessons = c.modules.flatMap((m: { lessons: unknown[] }) => m.lessons);
    expect(lessons.length).toBe(7);
    expect(c.skills.length).toBeGreaterThan(0);
    expect(c.quizzes.map((q: { id: string }) => q.id)).toContain('quiz-fractions-checkpoint');
  });

  it('404s for an unknown course with the error envelope', async () => {
    const res = await api().get('/api/courses/does-not-exist').set('Cookie', student.cookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns a lesson with content, key points, skills, practice link and marks it in progress', async () => {
    const res = await api().get('/api/lessons/les-frac-equivalent').set('Cookie', student.cookie);
    expect(res.status).toBe(200);
    const l = res.body.lesson;
    expect(l.title).toBe('Equivalent Fractions');
    expect(l.contentMd.length).toBeGreaterThan(100);
    expect(l.keyPoints.length).toBeGreaterThan(0);
    expect(l.skills.map((s: { id: string }) => s.id)).toContain('frac-equivalent');
    expect(l.practiceAssessmentId).toBe('prac-les-frac-equivalent');
    expect(l.nextLessonId).toBe('les-frac-compare');
    expect(['in_progress', 'completed']).toContain(l.status);
    // tutor notes are internal to the tutor; ensure no raw system prompt leaks
    expect(JSON.stringify(l)).not.toMatch(/system prompt/i);
  });

  it('serves the Hindi translation when available and falls back to English otherwise', async () => {
    const hi = await api().get('/api/lessons/les-frac-equivalent?lang=hi').set('Cookie', student.cookie);
    expect(hi.body.lesson.translation.status).toBe('available');
    expect(hi.body.lesson.translation.language).toBe('hi');
    expect(hi.body.lesson.translation.title).toBe('तुल्य भिन्न');
    const ta = await api().get('/api/lessons/les-frac-equivalent?lang=ta').set('Cookie', student.cookie);
    expect(ta.body.lesson.translation.status).toBe('available');
    expect(ta.body.lesson.translation.language).toBe('ta');
    const fallback = await api().get('/api/lessons/les-py-loops?lang=hi').set('Cookie', student.cookie);
    expect(fallback.body.lesson.translation.status).toBe('fallback');
    expect(fallback.body.lesson.translation.contentMd).toBe(fallback.body.lesson.contentMd);
  });

  it('marks a lesson complete once, awards points and regenerates recommendations', async () => {
    const first = await api().post('/api/lessons/les-py-what/progress').set('Cookie', student.cookie).send({ status: 'completed' });
    expect(first.status).toBe(200);
    expect(first.body.progress.status).toBe('completed');
    expect(Array.isArray(first.body.recommendations)).toBe(true);
    const again = await api().post('/api/lessons/les-py-what/progress').set('Cookie', student.cookie).send({ status: 'completed' });
    expect(again.body.progress.completedNow).toBe(false);
    expect(again.body.progress.pointsAwarded).toBe(0);
  });

  it('lists resources with DIKSHA adapter results clearly marked as demo data', async () => {
    const res = await api().get('/api/resources?q=fraction').set('Cookie', student.cookie);
    expect(res.status).toBe(200);
    expect(res.body.resources.length).toBeGreaterThan(0);
    expect(res.body.diksha.live).toBe(false);
    expect(res.body.diksha.resources.every((r: { isDemo: boolean; source: string }) => r.isDemo && r.source === 'DIKSHA (DEMO DATA)')).toBe(true);
  });

  it('exposes the public language catalogue', async () => {
    const res = await api().get('/api/i18n/languages');
    expect(res.status).toBe(200);
    const codes = res.body.languages.map((l: { code: string }) => l.code);
    expect(codes).toEqual(['en', 'hi', 'ta', 'unr']);
    const unr = res.body.languages.find((l: { code: string }) => l.code === 'unr');
    expect(unr.status).toBe('pilot');
    expect(unr.lessonTranslations).toBe(0);
    expect(res.body.translationProvider.live).toBe(false);
  });
});
