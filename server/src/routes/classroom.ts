/**
 * Classes, assignments, submissions and teacher analytics.
 */
import { Router } from 'express';
import { z } from 'zod';
import { nowIso, q } from '../db/index.js';
import { forbidden, notFound } from '../lib/errors.js';
import { newId, paramString, validate } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  assertTeacherOwnsClass,
  classAnalytics,
  listClassesForStudent,
  listClassesForTeacher,
  studentDetailForTeacher,
  teacherCanSeeStudent,
  teacherOverview,
} from '../services/analytics.js';
import { getAssessmentMeta } from '../services/assessment.js';
import { logActivity } from '../services/progress.js';
import type { Assignment, Submission } from '@shared/types';

export const classroomRouter = Router();
classroomRouter.use(requireAuth);

// ---- Classes ----------------------------------------------------------------
classroomRouter.get('/classes', (req, res) => {
  const s = req.session!;
  if (s.role === 'student') return res.json({ classes: listClassesForStudent(s.sub) });
  if (s.role === 'admin') {
    const all = q.all<{ id: string; name: string; grade: number; teacher_id: string; join_code: string; student_count: number }>(
      'SELECT c.*, (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id) AS student_count FROM classes c ORDER BY c.grade',
    );
    return res.json({ classes: all.map((c) => ({ id: c.id, name: c.name, grade: c.grade, teacherId: c.teacher_id, joinCode: c.join_code, studentCount: c.student_count })) });
  }
  res.json({ classes: listClassesForTeacher(s.sub) });
});

classroomRouter.get('/classes/:id/analytics', requireRole('teacher', 'admin'), (req, res) => {
  const classroom = assertTeacherOwnsClass(req.session!.sub, paramString(req, 'id'), req.session!.role);
  res.json({ analytics: classAnalytics(classroom) });
});

classroomRouter.get('/classes/:id/students', requireRole('teacher', 'admin'), (req, res) => {
  const classroom = assertTeacherOwnsClass(req.session!.sub, paramString(req, 'id'), req.session!.role);
  res.json({ students: classAnalytics(classroom).students });
});

classroomRouter.get('/students/:id/detail', requireRole('teacher', 'admin'), (req, res) => {
  const id = paramString(req, 'id');
  if (!teacherCanSeeStudent(req.session!.sub, id, req.session!.role)) throw forbidden('Student is not in one of your classes');
  res.json({ detail: studentDetailForTeacher(id) });
});

classroomRouter.get('/analytics/teacher/overview', requireRole('teacher', 'admin'), (req, res) => {
  res.json({ overview: teacherOverview(req.session!.sub) });
});

// ---- Assignments -------------------------------------------------------------
interface AssignmentRow {
  id: string;
  class_id: string;
  class_name: string;
  teacher_id: string;
  title: string;
  description: string;
  type: Assignment['type'];
  assessment_id: string | null;
  due_at: string | null;
  created_at: string;
  submission_count: number;
}

function mapAssignment(r: AssignmentRow): Assignment {
  return {
    id: r.id,
    classId: r.class_id,
    className: r.class_name,
    teacherId: r.teacher_id,
    title: r.title,
    description: r.description,
    type: r.type,
    assessmentId: r.assessment_id,
    dueAt: r.due_at,
    createdAt: r.created_at,
    submissionCount: r.submission_count,
  };
}

function mapSubmission(r: {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name?: string;
  project_id: string | null;
  attempt_id: string | null;
  content: string;
  status: Submission['status'];
  grade: number | null;
  feedback: string | null;
  submitted_at: string;
}): Submission {
  return {
    id: r.id,
    assignmentId: r.assignment_id,
    studentId: r.student_id,
    studentName: r.student_name,
    projectId: r.project_id,
    attemptId: r.attempt_id,
    content: r.content,
    status: r.status,
    grade: r.grade,
    feedback: r.feedback,
    submittedAt: r.submitted_at,
  };
}

const ASSIGNMENT_SELECT = `SELECT a.*, c.name AS class_name, (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submission_count FROM assignments a JOIN classes c ON c.id = a.class_id`;

classroomRouter.get('/assignments', (req, res) => {
  const s = req.session!;
  if (s.role === 'student') {
    const rows = q.all<AssignmentRow>(`${ASSIGNMENT_SELECT} WHERE a.class_id IN (SELECT class_id FROM class_students WHERE student_id = ?) ORDER BY a.due_at IS NULL, a.due_at`, s.sub);
    const assignments = rows.map((r) => {
      const mine = q.get<Parameters<typeof mapSubmission>[0]>('SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?', r.id, s.sub);
      return { ...mapAssignment(r), mySubmission: mine ? mapSubmission(mine) : null };
    });
    return res.json({ assignments });
  }
  const rows = s.role === 'admin' ? q.all<AssignmentRow>(`${ASSIGNMENT_SELECT} ORDER BY a.created_at DESC`) : q.all<AssignmentRow>(`${ASSIGNMENT_SELECT} WHERE a.teacher_id = ? ORDER BY a.created_at DESC`, s.sub);
  res.json({ assignments: rows.map(mapAssignment) });
});

const createAssignmentSchema = z.object({
  classId: z.string().min(1).max(100),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).default(''),
  type: z.enum(['assessment', 'project']),
  assessmentId: z.string().max(100).nullable().optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
});

classroomRouter.post('/assignments', requireRole('teacher', 'admin'), (req, res) => {
  const body = validate(createAssignmentSchema, req.body, 'assignment');
  assertTeacherOwnsClass(req.session!.sub, body.classId, req.session!.role);
  if (body.type === 'assessment') {
    if (!body.assessmentId || !getAssessmentMeta(body.assessmentId)) throw notFound('Assessment');
  }
  const id = newId('asg');
  q.run(
    'INSERT INTO assignments (id, class_id, teacher_id, title, description, type, assessment_id, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, body.classId, req.session!.sub, body.title, body.description, body.type, body.type === 'assessment' ? body.assessmentId : null, body.dueAt ?? null, nowIso(),
  );
  const row = q.get<AssignmentRow>(`${ASSIGNMENT_SELECT} WHERE a.id = ?`, id)!;
  res.status(201).json({ assignment: mapAssignment(row) });
});

classroomRouter.get('/assignments/:id', (req, res) => {
  const id = paramString(req, 'id');
  const row = q.get<AssignmentRow>(`${ASSIGNMENT_SELECT} WHERE a.id = ?`, id);
  if (!row) throw notFound('Assignment');
  const s = req.session!;
  if (s.role === 'student') {
    const enrolled = q.get('SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?', row.class_id, s.sub);
    if (!enrolled) throw forbidden();
    const mine = q.get<Parameters<typeof mapSubmission>[0]>('SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?', id, s.sub);
    return res.json({ assignment: { ...mapAssignment(row), mySubmission: mine ? mapSubmission(mine) : null } });
  }
  if (s.role === 'teacher' && row.teacher_id !== s.sub) throw forbidden();
  const submissions = q.all<Parameters<typeof mapSubmission>[0]>(
    'SELECT s.*, u.name AS student_name FROM submissions s JOIN users u ON u.id = s.student_id WHERE s.assignment_id = ? ORDER BY s.submitted_at DESC',
    id,
  );
  const roster = q.all<{ id: string; name: string }>('SELECT u.id, u.name FROM class_students cs JOIN users u ON u.id = cs.student_id WHERE cs.class_id = ? ORDER BY u.name', row.class_id);
  res.json({ assignment: mapAssignment(row), submissions: submissions.map(mapSubmission), roster });
});

// ---- Submissions -------------------------------------------------------------
const submitSchema = z.object({
  assignmentId: z.string().min(1).max(100),
  projectId: z.string().max(100).nullable().optional(),
  content: z.string().max(5000).default(''),
});

classroomRouter.post('/submissions', requireRole('student'), (req, res) => {
  const body = validate(submitSchema, req.body, 'submission');
  const s = req.session!;
  const assignment = q.get<{ id: string; class_id: string; type: string }>('SELECT id, class_id, type FROM assignments WHERE id = ?', body.assignmentId);
  if (!assignment) throw notFound('Assignment');
  if (!q.get('SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?', assignment.class_id, s.sub)) throw forbidden('You are not enrolled in this class');
  if (body.projectId) {
    const project = q.get<{ owner_id: string }>('SELECT owner_id FROM projects WHERE id = ?', body.projectId);
    if (!project) throw notFound('Project');
    if (project.owner_id !== s.sub) throw forbidden();
    q.run("UPDATE projects SET status = 'submitted', assignment_id = ?, updated_at = ? WHERE id = ?", body.assignmentId, nowIso(), body.projectId);
  }
  const id = newId('sub');
  const at = nowIso();
  q.run(
    `INSERT INTO submissions (id, assignment_id, student_id, project_id, attempt_id, content, status, grade, feedback, submitted_at)
     VALUES (?, ?, ?, ?, NULL, ?, 'submitted', NULL, NULL, ?)
     ON CONFLICT(assignment_id, student_id) DO UPDATE SET project_id = excluded.project_id, content = excluded.content, status = 'submitted', submitted_at = excluded.submitted_at`,
    id, body.assignmentId, s.sub, body.projectId ?? null, body.content, at,
  );
  logActivity(s.sub, 'submission', body.assignmentId, at);
  const row = q.get<Parameters<typeof mapSubmission>[0]>('SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?', body.assignmentId, s.sub)!;
  res.status(201).json({ submission: mapSubmission(row) });
});

classroomRouter.get('/submissions/:id', (req, res) => {
  const id = paramString(req, 'id');
  const row = q.get<Parameters<typeof mapSubmission>[0] & { teacher_id: string }>(
    'SELECT s.*, u.name AS student_name, a.teacher_id FROM submissions s JOIN users u ON u.id = s.student_id JOIN assignments a ON a.id = s.assignment_id WHERE s.id = ?',
    id,
  );
  if (!row) throw notFound('Submission');
  const sess = req.session!;
  if (sess.role === 'student' && row.student_id !== sess.sub) throw forbidden();
  if (sess.role === 'teacher' && row.teacher_id !== sess.sub) throw forbidden();
  const project = row.project_id
    ? q.get<{ id: string; title: string; description: string; status: string }>('SELECT id, title, description, status FROM projects WHERE id = ?', row.project_id)
    : null;
  const documents = row.project_id ? q.all<{ id: string; title: string; format: string; updated_at: string }>('SELECT id, title, format, updated_at FROM documents WHERE project_id = ? ORDER BY updated_at DESC', row.project_id) : [];
  const files = row.project_id ? q.all<{ id: string; name: string; language: string; updated_at: string }>('SELECT id, name, language, updated_at FROM files WHERE project_id = ? ORDER BY name', row.project_id) : [];
  res.json({ submission: mapSubmission(row), project, documents, files });
});

classroomRouter.patch('/submissions/:id/grade', requireRole('teacher', 'admin'), (req, res) => {
  const id = paramString(req, 'id');
  const body = validate(z.object({ grade: z.number().min(0).max(100), feedback: z.string().max(2000).default('') }), req.body, 'grade');
  const row = q.get<{ teacher_id: string; student_id: string }>('SELECT a.teacher_id, s.student_id FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = ?', id);
  if (!row) throw notFound('Submission');
  if (req.session!.role === 'teacher' && row.teacher_id !== req.session!.sub) throw forbidden();
  q.run("UPDATE submissions SET grade = ?, feedback = ?, status = 'graded' WHERE id = ?", body.grade, body.feedback, id);
  const updated = q.get<Parameters<typeof mapSubmission>[0]>('SELECT * FROM submissions WHERE id = ?', id)!;
  res.json({ submission: mapSubmission(updated) });
});
