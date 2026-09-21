import { nowIso, parseJson, q, tx } from '../db/index.js';
import { newId, round } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import {
  adaptiveLevelFor,
  difficultyWeightsFor,
  getStudentSkills,
  recordSkillEvidence,
  regenerateRecommendations,
} from './adaptive.js';
import { logActivity, touchLessonProgress, addPoints } from './progress.js';
import type { Assessment, Attempt, AttemptAnswer, Question, QuestionFeedback, SkillBreakdown } from '@shared/types';

interface QuestionRow {
  id: string;
  lesson_id: string | null;
  skill_id: string;
  skill_name: string;
  type: 'mcq' | 'short';
  prompt: string;
  options_json: string | null;
  answer_key_json: string;
  explanation: string;
  difficulty: 1 | 2 | 3;
  points: number;
  position: number;
}

type AnswerKey = { index: number } | { accept: string[] };

function loadQuestions(assessmentId: string): QuestionRow[] {
  return q.all<QuestionRow>(
    `SELECT qu.*, aq.position, aq.points, s.name AS skill_name
       FROM assessment_questions aq
       JOIN questions qu ON qu.id = aq.question_id
       JOIN skills s ON s.id = qu.skill_id
      WHERE aq.assessment_id = ?
      ORDER BY aq.position`,
    assessmentId,
  );
}

function toPublicQuestion(r: QuestionRow): Question {
  return {
    id: r.id,
    lessonId: r.lesson_id,
    skillId: r.skill_id,
    type: r.type,
    prompt: r.prompt,
    options: parseJson<string[] | null>(r.options_json, null),
    difficulty: r.difficulty,
    points: r.points,
  };
}

export function getAssessmentMeta(id: string): Assessment | undefined {
  const row = q.get<{
    id: string;
    course_id: string | null;
    lesson_id: string | null;
    title: string;
    description: string;
    type: Assessment['type'];
    time_limit_min: number | null;
    question_count: number;
  }>(
    `SELECT a.*, (SELECT COUNT(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id) AS question_count
       FROM assessments a WHERE a.id = ?`,
    id,
  );
  if (!row) return undefined;
  return {
    id: row.id,
    courseId: row.course_id,
    lessonId: row.lesson_id,
    title: row.title,
    description: row.description,
    type: row.type,
    timeLimitMin: row.time_limit_min,
    questionCount: row.question_count,
  };
}

/**
 * Assessment as presented to a student — answer keys are never included.
 * Practice sets are adapted: question order weighted by the student's mastery level.
 */
export function getAssessmentForStudent(id: string, studentId: string): Assessment {
  const meta = getAssessmentMeta(id);
  if (!meta) throw notFound('Assessment');
  let rows = loadQuestions(id);
  const skillIds = [...new Set(rows.map((r) => r.skill_id))];
  const adaptive = adaptiveLevelFor(studentId, skillIds);
  if (meta.type === 'practice' && rows.length > 0) {
    const weights = difficultyWeightsFor(adaptive.level);
    const skills = getStudentSkills(studentId);
    const masteryOf = (skillId: string) => skills.find((s) => s.id === skillId)?.mastery ?? 50;
    // Deterministic ordering: weakest skills first, then preferred difficulty for the level.
    rows = [...rows].sort((a, b) => {
      const ma = masteryOf(a.skill_id);
      const mb = masteryOf(b.skill_id);
      if (ma !== mb) return ma - mb;
      const wa = weights[a.difficulty] ?? 1;
      const wb = weights[b.difficulty] ?? 1;
      if (wa !== wb) return wb - wa;
      return a.position - b.position;
    });
    const maxQuestions = adaptive.level === 'advanced' ? 6 : 5;
    rows = rows.slice(0, maxQuestions);
  }
  return {
    ...meta,
    questions: rows.map(toPublicQuestion),
    questionCount: rows.length,
    adaptiveLevel: adaptive.level,
    adaptiveNote: adaptive.note,
  };
}

function normaliseText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function gradeOne(row: QuestionRow, answer: string | number | null): { correct: boolean; yourAnswer: string | null; correctAnswer: string } {
  const key = parseJson<AnswerKey>(row.answer_key_json, { accept: [] });
  const options = parseJson<string[] | null>(row.options_json, null);
  if ('index' in key) {
    const idx = typeof answer === 'number' ? answer : typeof answer === 'string' && answer !== '' ? Number(answer) : NaN;
    const correct = Number.isInteger(idx) && idx === key.index;
    return {
      correct,
      yourAnswer: Number.isInteger(idx) && options && options[idx] !== undefined ? options[idx] : null,
      correctAnswer: options?.[key.index] ?? String(key.index),
    };
  }
  const text = answer === null || answer === undefined ? '' : String(answer);
  const correct = key.accept.some((a) => normaliseText(a) === normaliseText(text));
  return { correct, yourAnswer: text || null, correctAnswer: key.accept[0] ?? '' };
}

export interface SubmitResult extends Attempt {
  feedback: QuestionFeedback[];
  skillBreakdown: SkillBreakdown[];
  weakSkills: SkillBreakdown[];
  pointsEarned: number;
}

/** Grade + persist an attempt, update mastery, progress and recommendations — one transaction. */
export function submitAttempt(assessmentId: string, studentId: string, answers: AttemptAnswer[], at = nowIso()): SubmitResult {
  const meta = getAssessmentMeta(assessmentId);
  if (!meta) throw notFound('Assessment');
  const rows = loadQuestions(assessmentId);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const answered = new Map(answers.map((a) => [a.questionId, a.answer]));

  // Only grade the questions that were presented (those answered or all if none) — practice sets are subsets.
  const presented = rows.filter((r) => answered.has(r.id));
  const graded = presented.length > 0 ? presented : rows;

  return tx(() => {
    const feedback: QuestionFeedback[] = [];
    const perSkill = new Map<string, SkillBreakdown>();
    let score = 0;
    let maxScore = 0;

    for (const row of graded) {
      const g = gradeOne(row, answered.get(row.id) ?? null);
      const earned = g.correct ? row.points : 0;
      score += earned;
      maxScore += row.points;
      feedback.push({
        questionId: row.id,
        prompt: row.prompt,
        skillId: row.skill_id,
        skillName: row.skill_name,
        correct: g.correct,
        yourAnswer: g.yourAnswer,
        correctAnswer: g.correctAnswer,
        explanation: row.explanation,
        points: row.points,
        earned,
      });
      const mastery = recordSkillEvidence(studentId, row.skill_id, g.correct, at);
      const sb = perSkill.get(row.skill_id) ?? {
        skillId: row.skill_id,
        skillName: row.skill_name,
        correct: 0,
        total: 0,
        percent: 0,
        mastery,
        weak: false,
      };
      sb.correct += g.correct ? 1 : 0;
      sb.total += 1;
      sb.mastery = mastery;
      perSkill.set(row.skill_id, sb);
      void byId;
    }

    const skillBreakdown = [...perSkill.values()].map((s) => ({
      ...s,
      percent: s.total ? round((s.correct / s.total) * 100, 0) : 0,
      weak: s.total ? s.correct / s.total < 0.6 || s.mastery < 60 : false,
    }));
    const percent = maxScore ? round((score / maxScore) * 100, 0) : 0;
    const attemptId = newId('att');
    q.run(
      `INSERT INTO attempts (id, assessment_id, student_id, started_at, submitted_at, score, max_score, percent, answers_json, feedback_json, skill_breakdown_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
      attemptId,
      assessmentId,
      studentId,
      at,
      at,
      score,
      maxScore,
      percent,
      JSON.stringify(answers),
      JSON.stringify(feedback),
      JSON.stringify(skillBreakdown),
    );

    // Progress + points
    const pointsEarned = Math.round(score * 10) + (percent >= 80 ? 20 : 0);
    addPoints(studentId, pointsEarned, at);
    if (meta.lessonId) {
      touchLessonProgress(studentId, meta.lessonId, percent >= 60 ? 'completed' : 'in_progress', at, 100);
    }
    logActivity(studentId, 'attempt', attemptId, at);

    const recommendations = regenerateRecommendations(studentId, meta.title);
    const weakSkills = skillBreakdown.filter((s) => s.weak).sort((a, b) => a.percent - b.percent);

    return {
      id: attemptId,
      assessmentId,
      assessmentTitle: meta.title,
      studentId,
      startedAt: at,
      submittedAt: at,
      score,
      maxScore,
      percent,
      status: 'submitted',
      feedback,
      skillBreakdown,
      weakSkills,
      recommendations,
      pointsEarned,
    };
  });
}

export function getAttempt(id: string): Attempt | undefined {
  const row = q.get<{
    id: string;
    assessment_id: string;
    assessment_title: string;
    student_id: string;
    started_at: string;
    submitted_at: string | null;
    score: number;
    max_score: number;
    percent: number;
    status: Attempt['status'];
    feedback_json: string;
    skill_breakdown_json: string;
  }>(
    `SELECT at.*, a.title AS assessment_title FROM attempts at JOIN assessments a ON a.id = at.assessment_id WHERE at.id = ?`,
    id,
  );
  if (!row) return undefined;
  const skillBreakdown = parseJson<SkillBreakdown[]>(row.skill_breakdown_json, []);
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    assessmentTitle: row.assessment_title,
    studentId: row.student_id,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    score: row.score,
    maxScore: row.max_score,
    percent: row.percent,
    status: row.status,
    feedback: parseJson<QuestionFeedback[]>(row.feedback_json, []),
    skillBreakdown,
    weakSkills: skillBreakdown.filter((s) => s.weak),
  };
}

export function listAttempts(studentId: string, limit = 20): Attempt[] {
  const rows = q.all<{
    id: string;
    assessment_id: string;
    assessment_title: string;
    student_id: string;
    started_at: string;
    submitted_at: string | null;
    score: number;
    max_score: number;
    percent: number;
    status: Attempt['status'];
  }>(
    `SELECT at.id, at.assessment_id, a.title AS assessment_title, at.student_id, at.started_at, at.submitted_at, at.score, at.max_score, at.percent, at.status
       FROM attempts at JOIN assessments a ON a.id = at.assessment_id
      WHERE at.student_id = ? ORDER BY at.submitted_at DESC LIMIT ?`,
    studentId,
    limit,
  );
  return rows.map((r) => ({
    id: r.id,
    assessmentId: r.assessment_id,
    assessmentTitle: r.assessment_title,
    studentId: r.student_id,
    startedAt: r.started_at,
    submittedAt: r.submitted_at,
    score: r.score,
    maxScore: r.max_score,
    percent: r.percent,
    status: r.status,
  }));
}

/** Teacher helper: build a quick assessment from the question bank by skill. */
export function createAssessmentFromSkills(opts: {
  title: string;
  description: string;
  skillIds: string[];
  questionsPerSkill: number;
  createdBy: string;
  courseId?: string | null;
  type?: Assessment['type'];
  timeLimitMin?: number | null;
}): Assessment {
  const id = newId('asm');
  return tx(() => {
    q.run(
      'INSERT INTO assessments (id, course_id, lesson_id, title, description, type, time_limit_min, created_by, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)',
      id,
      opts.courseId ?? null,
      opts.title,
      opts.description,
      opts.type ?? 'assignment',
      opts.timeLimitMin ?? null,
      opts.createdBy,
      nowIso(),
    );
    let position = 0;
    for (const skillId of opts.skillIds) {
      const qs = q.all<{ id: string }>('SELECT id FROM questions WHERE skill_id = ? ORDER BY difficulty, id LIMIT ?', skillId, opts.questionsPerSkill);
      for (const qu of qs) {
        q.run('INSERT OR IGNORE INTO assessment_questions (assessment_id, question_id, position, points) VALUES (?, ?, ?, 1)', id, qu.id, position++);
      }
    }
    const meta = getAssessmentMeta(id);
    if (!meta) throw notFound('Assessment');
    return meta;
  });
}
