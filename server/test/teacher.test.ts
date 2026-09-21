import { beforeAll, describe, expect, it } from 'vitest';
import { api, loginAs, loginWithPassword, type Session } from './helpers.js';

let teacher: Session;
let student: Session;
let admin: Session;

beforeAll(async () => {
  teacher = await loginAs('teacher');
  student = await loginAs('student');
  admin = await loginAs('admin');
});

describe('teacher analytics & classroom', () => {
  it('returns the teacher overview with totals, classes and weak areas', async () => {
    const res = await api().get('/api/analytics/teacher/overview').set('Cookie', teacher.cookie);
    expect(res.status).toBe(200);
    const o = res.body.overview;
    expect(o.totals.classes).toBe(1);
    expect(o.totals.students).toBe(8);
    expect(o.classes[0].classroom.id).toBe('cls_6a');
    expect(Array.isArray(o.classes[0].weakAreas)).toBe(true);
    expect(o.activity.length).toBe(14);
  });

  it('returns class analytics: students with risk status, heatmap, distribution and weak areas', async () => {
    const res = await api().get('/api/classes/cls_6a/analytics').set('Cookie', teacher.cookie);
    expect(res.status).toBe(200);
    const a = res.body.analytics;
    expect(a.students.length).toBe(8);
    expect(a.summary.studentCount).toBe(8);
    expect(a.summary.averageScore).toBeGreaterThan(0);
    expect(a.students.every((s: { risk: string }) => ['on_track', 'needs_support', 'inactive'].includes(s.risk))).toBe(true);
    const kabir = a.students.find((s: { id: string }) => s.id === 'usr_s_kabir');
    expect(kabir.risk).toBe('inactive');
    expect(a.skillHeatmap.length).toBeGreaterThan(0);
    expect(a.scoreDistribution.reduce((n: number, b: { count: number }) => n + b.count, 0)).toBe(a.summary.totalAttempts);
    expect(a.weakAreas.every((w: { averageMastery: number }) => w.averageMastery < 60)).toBe(true);
  });

  it('returns a student detail view for the teacher', async () => {
    const res = await api().get('/api/students/usr_s_rohan/detail').set('Cookie', teacher.cookie);
    expect(res.status).toBe(200);
    expect(res.body.detail.student.name).toMatch(/Rohan/);
    expect(res.body.detail.skills.length).toBeGreaterThan(0);
    expect(res.body.detail.attempts.length).toBeGreaterThan(0);
  });

  it('creates an assessment from skills and assigns it; the student then sees it', async () => {
    const created = await api().post('/api/assessments').set('Cookie', teacher.cookie).send({ title: 'Fractions re-test', description: 'Focus on equivalent fractions', skillIds: ['frac-equivalent', 'frac-compare'], questionsPerSkill: 2, courseId: 'course-math6-fractions' });
    expect(created.status).toBe(201);
    expect(created.body.assessment.questionCount).toBe(4);
    const assignment = await api()
      .post('/api/assignments')
      .set('Cookie', teacher.cookie)
      .send({ classId: 'cls_6a', title: 'Re-test: fractions', description: 'Complete by Friday', type: 'assessment', assessmentId: created.body.assessment.id, dueAt: new Date(Date.now() + 3 * 86400000).toISOString() });
    expect(assignment.status).toBe(201);
    const mine = await api().get('/api/assignments').set('Cookie', student.cookie);
    const found = mine.body.assignments.find((a: { id: string }) => a.id === assignment.body.assignment.id);
    expect(found).toBeDefined();
    expect(found.mySubmission).toBeNull();
    // Student can open the generated assessment without keys
    const view = await api().get(`/api/assessments/${created.body.assessment.id}`).set('Cookie', student.cookie);
    expect(view.status).toBe(200);
    expect(view.body.assessment.questions.length).toBe(4);
    expect(JSON.stringify(view.body)).not.toMatch(/answerKey/);
  });

  it('teacher sees answer keys for review; student never does', async () => {
    const t = await api().get('/api/assessments/quiz-fractions-checkpoint').set('Cookie', teacher.cookie);
    expect(t.status).toBe(200);
    expect(t.body.assessment.questions[0]).toHaveProperty('answerKey');
    const s = await api().get('/api/assessments/quiz-fractions-checkpoint').set('Cookie', student.cookie);
    expect(s.body.assessment.questions[0]).not.toHaveProperty('answerKey');
  });

  it('shows assignment submissions with roster for the owning teacher', async () => {
    const res = await api().get('/api/assignments/asg_frac_quiz').set('Cookie', teacher.cookie);
    expect(res.status).toBe(200);
    expect(res.body.roster.length).toBe(8);
    expect(res.body.submissions.length).toBeGreaterThanOrEqual(2);
  });

  it('admin stats and system status are available to admin only', async () => {
    const res = await api().get('/api/admin/stats').set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.stats.users.total).toBeGreaterThanOrEqual(16);
    expect(res.body.system.ai.provider).toBe('demo');
    expect(res.body.system.execution.simulated).toBe(true);
    expect(res.body.system.pdfFonts.devanagari).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/jwtSecret":"|apiKey/);
    const denied = await api().get('/api/admin/stats').set('Cookie', teacher.cookie);
    expect(denied.status).toBe(403);
  });
});

describe('authorization boundaries', () => {
  it('rejects unauthenticated access to protected routes', async () => {
    for (const path of ['/api/courses', '/api/progress/me', '/api/projects', '/api/ai/conversations', '/api/classes']) {
      const res = await api().get(path);
      expect(res.status, path).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('students cannot access teacher analytics or admin routes', async () => {
    expect((await api().get('/api/analytics/teacher/overview').set('Cookie', student.cookie)).status).toBe(403);
    expect((await api().get('/api/classes/cls_6a/analytics').set('Cookie', student.cookie)).status).toBe(403);
    expect((await api().get('/api/students/usr_s_rohan/detail').set('Cookie', student.cookie)).status).toBe(403);
    expect((await api().get('/api/admin/stats').set('Cookie', student.cookie)).status).toBe(403);
    expect((await api().get('/api/users').set('Cookie', student.cookie)).status).toBe(403);
    expect((await api().post('/api/assignments').set('Cookie', student.cookie).send({ classId: 'cls_6a', title: 'Nope', type: 'project' })).status).toBe(403);
  });

  it('a teacher cannot read another teacher’s class or students', async () => {
    const other = await loginWithPassword('rahul.verma@demo.aieses', 'Demo@1234');
    expect((await api().get('/api/classes/cls_6a/analytics').set('Cookie', other.cookie)).status).toBe(403);
    expect((await api().get('/api/students/usr_s_rohan/detail').set('Cookie', other.cookie)).status).toBe(403);
    expect((await api().get('/api/assignments/asg_frac_quiz').set('Cookie', other.cookie)).status).toBe(403);
    // ...but can read their own class
    expect((await api().get('/api/classes/cls_8b/analytics').set('Cookie', other.cookie)).status).toBe(200);
  });

  it('teachers cannot write student-only resources', async () => {
    expect((await api().post('/api/projects').set('Cookie', teacher.cookie).send({ title: 'Teacher project' })).status).toBe(403);
    expect((await api().post('/api/assessments/prac-les-frac-what/submit').set('Cookie', teacher.cookie).send({ answers: [{ questionId: 'q', answer: 0 }] })).status).toBe(403);
  });

  it('rejects state-changing requests from a foreign origin (CSRF guard)', async () => {
    const res = await api().post('/api/projects').set('Cookie', student.cookie).set('Origin', 'https://evil.example').send({ title: 'CSRF attempt' });
    expect(res.status).toBe(403);
  });

  it('rejects tampered JWT cookies', async () => {
    const res = await api().get('/api/progress/me').set('Cookie', 'aieses_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3JfYWRtaW5fZGVtbyIsInJvbGUiOiJhZG1pbiJ9.invalidsignature');
    expect(res.status).toBe(401);
  });
});
