import { beforeAll, describe, expect, it } from 'vitest';
import { api, loginAs, type Session } from './helpers.js';

let student: Session;

beforeAll(async () => {
  student = await loginAs('student');
});

describe('assessment → score → progress → adaptive recommendation', () => {
  it('serves an assessment to a student without answer keys and with an adaptive note', async () => {
    const res = await api().get('/api/assessments/prac-les-frac-equivalent').set('Cookie', student.cookie);
    expect(res.status).toBe(200);
    const a = res.body.assessment;
    expect(a.questions.length).toBe(5);
    expect(a.adaptiveLevel).toBeDefined();
    expect(a.adaptiveNote).toMatch(/mastery/i);
    const raw = JSON.stringify(a);
    expect(raw).not.toMatch(/answerKey|answer_key|"accept"/);
    for (const q of a.questions) {
      expect(q).not.toHaveProperty('answerKey');
      expect(q).toHaveProperty('prompt');
      expect(q).toHaveProperty('options');
    }
  });

  it('scores a submission deterministically, returns feedback, weak skills and recommendations, and updates progress', async () => {
    const before = await api().get('/api/progress/me').set('Cookie', student.cookie);
    const pointsBefore = before.body.progress.points as number;
    const attemptsBefore = before.body.progress.attemptsCount as number;

    const assessment = await api().get('/api/assessments/prac-les-frac-equivalent').set('Cookie', student.cookie);
    const questions = assessment.body.assessment.questions as { id: string; options: string[] | null }[];
    // Deliberately answer everything with option 0 so the result is deterministic but not perfect.
    const answers = questions.map((q) => ({ questionId: q.id, answer: q.options ? 0 : 'x' }));

    const res = await api().post('/api/assessments/prac-les-frac-equivalent/submit').set('Cookie', student.cookie).send({ answers });
    expect(res.status).toBe(201);
    const attempt = res.body.attempt;
    expect(attempt.status).toBe('submitted');
    expect(attempt.maxScore).toBeGreaterThan(0);
    expect(attempt.percent).toBe(Math.round((attempt.score / attempt.maxScore) * 100));
    expect(attempt.feedback.length).toBe(5);
    for (const f of attempt.feedback) {
      expect(typeof f.correct).toBe('boolean');
      expect(f.correctAnswer).toBeTruthy();
      expect(f.explanation).toBeTruthy();
    }
    expect(attempt.skillBreakdown.length).toBeGreaterThan(0);
    expect(Array.isArray(attempt.recommendations)).toBe(true);
    expect(attempt.pointsEarned).toBe(attempt.score * 10 + (attempt.percent >= 80 ? 20 : 0));

    // Attempt is retrievable and belongs to the student
    const fetched = await api().get(`/api/attempts/${attempt.id}`).set('Cookie', student.cookie);
    expect(fetched.status).toBe(200);
    expect(fetched.body.attempt.percent).toBe(attempt.percent);

    // Progress reflects the attempt
    const after = await api().get('/api/progress/me').set('Cookie', student.cookie);
    expect(after.body.progress.attemptsCount).toBe(attemptsBefore + 1);
    expect(after.body.progress.points).toBe(pointsBefore + attempt.pointsEarned);
    expect(after.body.progress.recentAttempts[0].id).toBe(attempt.id);
  });

  it('generates adaptive recommendations for weak skills that link to real targets', async () => {
    // Force a weak skill: answer the light quiz with the wrong option index everywhere.
    const a = await api().get('/api/assessments/prac-les-light-luminous').set('Cookie', student.cookie);
    const questions = a.body.assessment.questions as { id: string; options: string[] | null }[];
    const submit = await api()
      .post('/api/assessments/prac-les-light-luminous/submit')
      .set('Cookie', student.cookie)
      .send({ answers: questions.map((q) => ({ questionId: q.id, answer: q.options ? q.options.length - 1 : 'wrong' })) });
    expect(submit.status).toBe(201);

    const skills = await api().get('/api/skills/me').set('Cookie', student.cookie);
    const weak = skills.body.skills.filter((s: { level: string }) => s.level === 'weak');
    expect(weak.length).toBeGreaterThan(0);

    const recs = await api().get('/api/recommendations/me').set('Cookie', student.cookie);
    expect(recs.status).toBe(200);
    const list = recs.body.recommendations as { type: string; href: string; source: string; skillId: string | null; priority: number; reason: string }[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.source === 'eduadapt-mvp')).toBe(true);
    expect(list.map((r) => r.type)).toEqual(expect.arrayContaining(['lesson', 'practice']));
    // Recommendations are sorted by priority and target weak skills
    const priorities = list.map((r) => r.priority);
    expect([...priorities].sort((x, y) => x - y)).toEqual(priorities);
    const weakIds = new Set(weak.map((s: { id: string }) => s.id));
    expect(list.some((r) => r.skillId && weakIds.has(r.skillId))).toBe(true);
    // Every lesson recommendation points at a lesson that exists
    for (const r of list.filter((x) => x.type === 'lesson').slice(0, 3)) {
      const id = r.href.split('/').pop();
      const lesson = await api().get(`/api/lessons/${id}`).set('Cookie', student.cookie);
      expect(lesson.status).toBe(200);
    }
  });

  it('is deterministic: recomputing recommendations yields the same targets', async () => {
    const first = await api().post('/api/recommendations/refresh').set('Cookie', student.cookie);
    const second = await api().post('/api/recommendations/refresh').set('Cookie', student.cookie);
    const key = (r: { type: string; targetId: string }) => `${r.type}:${r.targetId}`;
    expect(second.body.recommendations.map(key)).toEqual(first.body.recommendations.map(key));
  });

  it('lets a student mark a recommendation done', async () => {
    const recs = await api().get('/api/recommendations/me').set('Cookie', student.cookie);
    const target = recs.body.recommendations[0];
    const res = await api().post(`/api/recommendations/${target.id}/done`).set('Cookie', student.cookie);
    expect(res.status).toBe(200);
    expect(res.body.recommendations.find((r: { id: string }) => r.id === target.id)).toBeUndefined();
  });

  it('validates the submission payload', async () => {
    const res = await api().post('/api/assessments/prac-les-frac-equivalent/submit').set('Cookie', student.cookie).send({ answers: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const missing = await api().post('/api/assessments/nope/submit').set('Cookie', student.cookie).send({ answers: [{ questionId: 'q', answer: 0 }] });
    expect(missing.status).toBe(404);
  });

  it('records an auto-graded submission when the assessment is assigned to the student class', async () => {
    const a = await api().get('/api/assessments/quiz-fractions-checkpoint').set('Cookie', student.cookie);
    const questions = a.body.assessment.questions as { id: string; options: string[] | null }[];
    await api().post('/api/assessments/quiz-fractions-checkpoint/submit').set('Cookie', student.cookie).send({ answers: questions.map((q) => ({ questionId: q.id, answer: 0 })) });
    const assignments = await api().get('/api/assignments').set('Cookie', student.cookie);
    const quiz = assignments.body.assignments.find((x: { assessmentId: string | null }) => x.assessmentId === 'quiz-fractions-checkpoint');
    expect(quiz).toBeDefined();
    expect(quiz.mySubmission.status).toBe('graded');
    expect(typeof quiz.mySubmission.grade).toBe('number');
  });
});
