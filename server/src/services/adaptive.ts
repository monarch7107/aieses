/**
 * EduAdapt — Adaptive Recommendation MVP.
 *
 * Deterministic, rule-based baseline (NOT a machine-learning model):
 *   assessment performance + lesson→skill mapping + recent mistakes
 *     → per-skill mastery (exponential moving average)
 *     → weak skills (mastery < 60 after ≥ 1 attempt)
 *     → recommended lesson / resource / practice, with a human-readable reason.
 */
import { nowIso, q, tx } from '../db/index.js';
import { newId, clamp, round } from '../lib/http.js';
import type { Recommendation, StudentSkill } from '@shared/types';

export const WEAK_THRESHOLD = 60;
export const STRONG_THRESHOLD = 80;
const EMA_ALPHA = 0.35; // weight given to the newest evidence

export function masteryLevel(mastery: number, attempts: number): StudentSkill['level'] {
  if (attempts === 0) return 'new';
  if (mastery < WEAK_THRESHOLD) return 'weak';
  if (mastery < STRONG_THRESHOLD) return 'developing';
  return 'strong';
}

/** Update a student's mastery for one skill using one piece of evidence (correct / incorrect). */
export function recordSkillEvidence(studentId: string, skillId: string, correct: boolean, at = nowIso()): number {
  const row = q.get<{ mastery: number; attempts_count: number; correct_count: number }>(
    'SELECT mastery, attempts_count, correct_count FROM student_skills WHERE student_id = ? AND skill_id = ?',
    studentId,
    skillId,
  );
  const evidence = correct ? 100 : 0;
  let mastery: number;
  if (!row) {
    // First evidence: start from a neutral prior of 50 and move towards the evidence.
    mastery = 50 + (evidence - 50) * 0.6;
    q.run(
      'INSERT INTO student_skills (student_id, skill_id, mastery, attempts_count, correct_count, last_updated) VALUES (?, ?, ?, 1, ?, ?)',
      studentId,
      skillId,
      round(mastery),
      correct ? 1 : 0,
      at,
    );
  } else {
    mastery = row.mastery * (1 - EMA_ALPHA) + evidence * EMA_ALPHA;
    q.run(
      'UPDATE student_skills SET mastery = ?, attempts_count = attempts_count + 1, correct_count = correct_count + ?, last_updated = ? WHERE student_id = ? AND skill_id = ?',
      round(clamp(mastery, 0, 100)),
      correct ? 1 : 0,
      at,
      studentId,
      skillId,
    );
  }
  return round(clamp(mastery, 0, 100));
}

export function getStudentSkills(studentId: string, subjectId?: string): StudentSkill[] {
  const rows = q.all<{
    id: string;
    subject_id: string;
    name: string;
    description: string;
    mastery: number | null;
    attempts_count: number | null;
    correct_count: number | null;
    last_updated: string | null;
  }>(
    `SELECT s.id, s.subject_id, s.name, s.description, ss.mastery, ss.attempts_count, ss.correct_count, ss.last_updated
       FROM skills s
       LEFT JOIN student_skills ss ON ss.skill_id = s.id AND ss.student_id = ?
      WHERE (? IS NULL OR s.subject_id = ?)
      ORDER BY s.subject_id, s.name`,
    studentId,
    subjectId ?? null,
    subjectId ?? null,
  );
  return rows.map((r) => {
    const attempts = r.attempts_count ?? 0;
    const mastery = attempts === 0 ? 0 : (r.mastery ?? 0);
    return {
      id: r.id,
      subjectId: r.subject_id,
      name: r.name,
      description: r.description,
      mastery,
      attemptsCount: attempts,
      correctCount: r.correct_count ?? 0,
      lastUpdated: r.last_updated,
      level: masteryLevel(mastery, attempts),
    };
  });
}

export function getWeakSkills(studentId: string, limit = 5): StudentSkill[] {
  return getStudentSkills(studentId)
    .filter((s) => s.level === 'weak')
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, limit);
}

/** Pick questions from a pool adapted to the student's mastery of the covered skills. */
export function adaptiveLevelFor(studentId: string, skillIds: string[]): {
  level: 'foundation' | 'intermediate' | 'advanced';
  note: string;
  avgMastery: number | null;
} {
  if (skillIds.length === 0) return { level: 'foundation', note: 'Starting at foundation level.', avgMastery: null };
  const skills = getStudentSkills(studentId).filter((s) => skillIds.includes(s.id) && s.attemptsCount > 0);
  if (skills.length === 0) {
    return { level: 'foundation', note: 'No previous attempts on these skills — starting at foundation level.', avgMastery: null };
  }
  const avg = skills.reduce((a, s) => a + s.mastery, 0) / skills.length;
  if (avg < 50) return { level: 'foundation', note: `Your mastery on these skills is ${round(avg, 0)}% — questions focus on fundamentals.`, avgMastery: round(avg, 0) };
  if (avg < 80) return { level: 'intermediate', note: `Your mastery on these skills is ${round(avg, 0)}% — mixing core and stretch questions.`, avgMastery: round(avg, 0) };
  return { level: 'advanced', note: `Your mastery on these skills is ${round(avg, 0)}% — including harder questions to stretch you.`, avgMastery: round(avg, 0) };
}

export function difficultyWeightsFor(level: 'foundation' | 'intermediate' | 'advanced'): Record<1 | 2 | 3, number> {
  if (level === 'foundation') return { 1: 3, 2: 2, 3: 1 };
  if (level === 'intermediate') return { 1: 2, 2: 3, 3: 2 };
  return { 1: 1, 2: 2, 3: 3 };
}

interface RecoDraft {
  type: Recommendation['type'];
  targetId: string;
  title: string;
  reason: string;
  priority: number;
  skillId: string | null;
}

function hrefFor(type: Recommendation['type'], targetId: string): string {
  switch (type) {
    case 'lesson':
      return `/lessons/${targetId}`;
    case 'practice':
      return `/assessments/${targetId}`;
    case 'resource':
      return `/resources?highlight=${targetId}`;
    case 'diksha':
      return `/resources?tab=diksha&highlight=${targetId}`;
    default:
      return '/';
  }
}

/**
 * Regenerate active recommendations for a student.
 * `triggerAssessmentTitle` lets the reason mention the assessment that surfaced the weakness.
 */
export function regenerateRecommendations(studentId: string, triggerAssessmentTitle?: string): Recommendation[] {
  return tx(() => {
    const weak = getWeakSkills(studentId, 3);
    const drafts: RecoDraft[] = [];
    const seen = new Set<string>();
    const push = (d: RecoDraft) => {
      const key = `${d.type}:${d.targetId}`;
      if (seen.has(key)) return;
      seen.add(key);
      drafts.push(d);
    };

    weak.forEach((skill, idx) => {
      const evidence = triggerAssessmentTitle
        ? `You scored ${skill.correctCount}/${skill.attemptsCount} on ${skill.name} questions (latest: “${triggerAssessmentTitle}”).`
        : `Your mastery of ${skill.name} is ${round(skill.mastery, 0)}% (${skill.correctCount}/${skill.attemptsCount} correct so far).`;
      const basePriority = 1 + idx * 3;

      // 1. Lesson teaching the skill that is not yet completed
      const lesson = q.get<{ id: string; title: string }>(
        `SELECT l.id, l.title FROM lessons l
           JOIN lesson_skills ls ON ls.lesson_id = l.id
           LEFT JOIN progress p ON p.lesson_id = l.id AND p.student_id = ?
          WHERE ls.skill_id = ?
          ORDER BY CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END, l.position
          LIMIT 1`,
        studentId,
        skill.id,
      );
      if (lesson) {
        push({
          type: 'lesson',
          targetId: lesson.id,
          title: `Review: ${lesson.title}`,
          reason: `${evidence} Re-read this lesson and use the AI Tutor for a simpler explanation.`,
          priority: basePriority,
          skillId: skill.id,
        });
      }

      // 2. Practice set for the skill
      const practice = q.get<{ id: string; title: string }>(
        `SELECT a.id, a.title FROM assessments a
           JOIN assessment_questions aq ON aq.assessment_id = a.id
           JOIN questions qu ON qu.id = aq.question_id
          WHERE qu.skill_id = ? AND a.type = 'practice'
          GROUP BY a.id ORDER BY COUNT(*) DESC LIMIT 1`,
        skill.id,
      );
      if (practice) {
        push({
          type: 'practice',
          targetId: practice.id,
          title: practice.title.startsWith('Practice') ? practice.title : `Practice: ${practice.title}`,
          reason: `Short adaptive practice set targeting ${skill.name}. Questions are chosen for your current level.`,
          priority: basePriority + 1,
          skillId: skill.id,
        });
      }

      // 3. External learning resource
      const resource = q.get<{ id: string; title: string; source: string }>(
        'SELECT id, title, source FROM learning_resources WHERE skill_id = ? ORDER BY language = ? DESC, id LIMIT 1',
        skill.id,
        'en',
      );
      if (resource) {
        push({
          type: 'resource',
          targetId: resource.id,
          title: resource.title,
          reason: `Alternative explanation of ${skill.name} from ${resource.source}.`,
          priority: basePriority + 2,
          skillId: skill.id,
        });
      }
    });

    // 4. Next-step recommendation: continue the most recently accessed course
    const next = q.get<{ id: string; title: string; course_title: string }>(
      `SELECT l.id, l.title, c.title AS course_title
         FROM lessons l
         JOIN modules m ON m.id = l.module_id
         JOIN courses c ON c.id = m.course_id
        WHERE c.id = (
          SELECT c2.id FROM progress p
            JOIN lessons l2 ON l2.id = p.lesson_id
            JOIN modules m2 ON m2.id = l2.module_id
            JOIN courses c2 ON c2.id = m2.course_id
           WHERE p.student_id = ?
           ORDER BY p.last_accessed_at DESC LIMIT 1)
          AND l.id NOT IN (SELECT lesson_id FROM progress WHERE student_id = ? AND status = 'completed')
        ORDER BY m.position, l.position LIMIT 1`,
      studentId,
      studentId,
    );
    if (next) {
      push({
        type: 'lesson',
        targetId: next.id,
        title: `Continue: ${next.title}`,
        reason: `Next lesson in “${next.course_title}”.`,
        priority: 20,
        skillId: null,
      });
    }

    // Replace active recommendations, preserving dismissed/done history.
    q.run("DELETE FROM recommendations WHERE student_id = ? AND status = 'active'", studentId);
    const dismissed = new Set(
      q
        .all<{ type: string; target_id: string }>(
          "SELECT type, target_id FROM recommendations WHERE student_id = ? AND status IN ('dismissed','done')",
          studentId,
        )
        .map((r) => `${r.type}:${r.target_id}`),
    );
    const at = nowIso();
    for (const d of drafts) {
      if (dismissed.has(`${d.type}:${d.targetId}`)) continue;
      q.run(
        'INSERT INTO recommendations (id, student_id, type, target_id, title, reason, priority, status, skill_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        newId('rec'),
        studentId,
        d.type,
        d.targetId,
        d.title,
        d.reason,
        d.priority,
        'active',
        d.skillId,
        'eduadapt-mvp',
        at,
      );
    }
    return getRecommendations(studentId);
  });
}

export function getRecommendations(studentId: string, status: 'active' | 'all' = 'active'): Recommendation[] {
  const rows = q.all<{
    id: string;
    student_id: string;
    type: Recommendation['type'];
    target_id: string;
    title: string;
    reason: string;
    priority: number;
    status: Recommendation['status'];
    skill_id: string | null;
    skill_name: string | null;
    source: string;
    created_at: string;
  }>(
    `SELECT r.*, s.name AS skill_name FROM recommendations r
       LEFT JOIN skills s ON s.id = r.skill_id
      WHERE r.student_id = ? AND (? = 'all' OR r.status = 'active')
      ORDER BY r.priority ASC, r.created_at DESC`,
    studentId,
    status,
  );
  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    type: r.type,
    targetId: r.target_id,
    title: r.title,
    reason: r.reason,
    priority: r.priority,
    status: r.status,
    skillId: r.skill_id,
    skillName: r.skill_name,
    source: r.source,
    createdAt: r.created_at,
    href: hrefFor(r.type, r.target_id),
  }));
}

export function setRecommendationStatus(studentId: string, id: string, status: 'done' | 'dismissed'): boolean {
  const res = q.run('UPDATE recommendations SET status = ? WHERE id = ? AND student_id = ?', status, id, studentId);
  return Number(res.changes) > 0;
}
