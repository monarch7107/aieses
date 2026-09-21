import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db/index.js';
import { forbidden, notFound } from '../lib/errors.js';
import { paramString, validate } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createAssessmentFromSkills, getAssessmentForStudent, getAssessmentMeta, getAttempt, listAttempts, submitAttempt } from '../services/assessment.js';
import { teacherCanSeeStudent } from '../services/analytics.js';

export const assessmentsRouter = Router();
assessmentsRouter.use(requireAuth);

assessmentsRouter.get('/assessments/:id', (req, res) => {
  const id = paramString(req, 'id');
  if (req.session!.role === 'student') return res.json({ assessment: getAssessmentForStudent(id, req.session!.sub) });
  const meta = getAssessmentMeta(id);
  if (!meta) throw notFound('Assessment');
  // Teachers/admins see the questions with their answer keys for review.
  const questions = q.all<{ id: string; prompt: string; options_json: string; answer_key_json: string; explanation: string; difficulty: number; skill_name: string; skill_id: string }>(
    `SELECT qu.id, qu.prompt, qu.options_json, qu.answer_key_json, qu.explanation, qu.difficulty, qu.skill_id, s.name AS skill_name
       FROM assessment_questions aq JOIN questions qu ON qu.id = aq.question_id JOIN skills s ON s.id = qu.skill_id WHERE aq.assessment_id = ? ORDER BY aq.position`,
    id,
  );
  res.json({
    assessment: {
      ...meta,
      questions: questions.map((r) => ({
        id: r.id,
        prompt: r.prompt,
        options: JSON.parse(r.options_json ?? 'null'),
        answerKey: JSON.parse(r.answer_key_json),
        explanation: r.explanation,
        difficulty: r.difficulty,
        skillId: r.skill_id,
        skillName: r.skill_name,
      })),
    },
  });
});

const submitSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.string().min(1).max(100), answer: z.union([z.string().max(500), z.number().int().min(0).max(50), z.null()]) }))
    .min(1)
    .max(100),
});

assessmentsRouter.post('/assessments/:id/submit', requireRole('student'), (req, res) => {
  const body = validate(submitSchema, req.body, 'submission');
  const id = paramString(req, 'id');
  if (!getAssessmentMeta(id)) throw notFound('Assessment');
  const result = submitAttempt(id, req.session!.sub, body.answers);
  // Auto-record assignment submission if this assessment is assigned to one of the student's classes
  const assignments = q.all<{ id: string }>(
    `SELECT a.id FROM assignments a JOIN class_students cs ON cs.class_id = a.class_id WHERE a.assessment_id = ? AND cs.student_id = ?`,
    id,
    req.session!.sub,
  );
  for (const a of assignments) {
    q.run(
      `INSERT INTO submissions (id, assignment_id, student_id, project_id, attempt_id, content, status, grade, feedback, submitted_at)
       VALUES (?, ?, ?, NULL, ?, ?, 'graded', ?, 'Auto-graded assessment', ?)
       ON CONFLICT(assignment_id, student_id) DO UPDATE SET attempt_id = excluded.attempt_id, grade = excluded.grade, status = 'graded', submitted_at = excluded.submitted_at`,
      `sub_${result.id}`, a.id, req.session!.sub, result.id, `Attempt ${result.id}: ${result.percent}%`, result.percent, result.submittedAt,
    );
  }
  res.status(201).json({ attempt: result });
});

assessmentsRouter.get('/attempts/me', requireRole('student'), (req, res) => {
  res.json({ attempts: listAttempts(req.session!.sub, 50) });
});

assessmentsRouter.get('/attempts/:id', (req, res) => {
  const attempt = getAttempt(paramString(req, 'id'));
  if (!attempt) throw notFound('Attempt');
  const s = req.session!;
  if (attempt.studentId !== s.sub && !(s.role !== 'student' && teacherCanSeeStudent(s.sub, attempt.studentId, s.role))) throw forbidden();
  res.json({ attempt });
});

const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).default(''),
  skillIds: z.array(z.string().min(1).max(60)).min(1).max(10),
  questionsPerSkill: z.number().int().min(1).max(5).default(2),
  courseId: z.string().max(100).nullable().optional(),
  timeLimitMin: z.number().int().min(1).max(180).nullable().optional(),
});

assessmentsRouter.post('/assessments', requireRole('teacher', 'admin'), (req, res) => {
  const body = validate(createSchema, req.body, 'assessment');
  const assessment = createAssessmentFromSkills({ ...body, createdBy: req.session!.sub, type: 'assignment' });
  res.status(201).json({ assessment });
});
