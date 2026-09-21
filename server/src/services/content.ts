import { parseJson, q } from '../db/index.js';
import { notFound } from '../lib/errors.js';
import type {
  Course,
  LanguageCode,
  LearningResource,
  Lesson,
  LessonSummary,
  LessonTranslation,
  Module,
  ProgressStatus,
  Skill,
  Subject,
  TutorNotes,
} from '@shared/types';

export function listSubjects(): Subject[] {
  return q
    .all<{ id: string; name: string; icon: string; color: string; description: string; course_count: number }>(
      `SELECT s.*, (SELECT COUNT(*) FROM courses c WHERE c.subject_id = s.id AND c.is_published = 1) AS course_count FROM subjects s ORDER BY s.name`,
    )
    .map((r) => ({ id: r.id, name: r.name, icon: r.icon, color: r.color, description: r.description, courseCount: r.course_count }));
}

interface CourseRow {
  id: string;
  subject_id: string;
  subject_name: string;
  title: string;
  description: string;
  grade: number;
  level: Course['level'];
  estimated_hours: number;
  color: string;
  is_published: number;
  lesson_count: number;
  completed: number | null;
}

function mapCourse(r: CourseRow): Course {
  const completed = r.completed ?? 0;
  return {
    id: r.id,
    subjectId: r.subject_id,
    subjectName: r.subject_name,
    title: r.title,
    description: r.description,
    grade: r.grade,
    level: r.level,
    estimatedHours: r.estimated_hours,
    color: r.color,
    isPublished: r.is_published === 1,
    lessonCount: r.lesson_count,
    completedLessons: completed,
    percent: r.lesson_count ? Math.round((completed / r.lesson_count) * 100) : 0,
  };
}

export function listCoursesForStudent(studentId: string | null, subjectId?: string): Course[] {
  const rows = q.all<CourseRow>(
    `SELECT c.*, s.name AS subject_name,
            (SELECT COUNT(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = c.id) AS lesson_count,
            (SELECT COUNT(*) FROM progress p JOIN lessons l ON l.id = p.lesson_id JOIN modules m ON m.id = l.module_id
              WHERE m.course_id = c.id AND p.student_id = ? AND p.status = 'completed') AS completed
       FROM courses c JOIN subjects s ON s.id = c.subject_id
      WHERE c.is_published = 1 AND (? IS NULL OR c.subject_id = ?)
      ORDER BY s.name, c.grade, c.title`,
    studentId ?? '',
    subjectId ?? null,
    subjectId ?? null,
  );
  return rows.map(mapCourse);
}

export function getCourseDetail(courseId: string, studentId: string | null): Course & { modules: Module[]; skills: Skill[]; quizzes: { id: string; title: string; description: string; questionCount: number; timeLimitMin: number | null }[] } {
  const row = q.get<CourseRow>(
    `SELECT c.*, s.name AS subject_name,
            (SELECT COUNT(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = c.id) AS lesson_count,
            (SELECT COUNT(*) FROM progress p JOIN lessons l ON l.id = p.lesson_id JOIN modules m ON m.id = l.module_id
              WHERE m.course_id = c.id AND p.student_id = ? AND p.status = 'completed') AS completed
       FROM courses c JOIN subjects s ON s.id = c.subject_id WHERE c.id = ?`,
    studentId ?? '',
    courseId,
  );
  if (!row) throw notFound('Course');
  const modules = q.all<{ id: string; course_id: string; title: string; description: string; position: number }>(
    'SELECT * FROM modules WHERE course_id = ? ORDER BY position',
    courseId,
  );
  const lessons = q.all<{
    id: string;
    module_id: string;
    title: string;
    summary: string;
    position: number;
    duration_min: number;
    status: ProgressStatus | null;
    percent: number | null;
  }>(
    `SELECT l.id, l.module_id, l.title, l.summary, l.position, l.duration_min, p.status, p.percent
       FROM lessons l JOIN modules m ON m.id = l.module_id
       LEFT JOIN progress p ON p.lesson_id = l.id AND p.student_id = ?
      WHERE m.course_id = ? ORDER BY m.position, l.position`,
    studentId ?? '',
    courseId,
  );
  const skills = q.all<Skill & { subject_id: string }>(
    `SELECT DISTINCT s.id, s.subject_id, s.name, s.description FROM skills s
       JOIN lesson_skills ls ON ls.skill_id = s.id JOIN lessons l ON l.id = ls.lesson_id JOIN modules m ON m.id = l.module_id
      WHERE m.course_id = ? ORDER BY s.name`,
    courseId,
  );
  const quizzes = q.all<{ id: string; title: string; description: string; question_count: number; time_limit_min: number | null }>(
    `SELECT a.id, a.title, a.description, a.time_limit_min, (SELECT COUNT(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id) AS question_count
       FROM assessments a WHERE a.course_id = ? AND a.type = 'quiz' ORDER BY a.created_at`,
    courseId,
  );
  return {
    ...mapCourse(row),
    modules: modules.map((m) => ({
      id: m.id,
      courseId: m.course_id,
      title: m.title,
      description: m.description,
      position: m.position,
      lessons: lessons
        .filter((l) => l.module_id === m.id)
        .map<LessonSummary>((l) => ({
          id: l.id,
          moduleId: l.module_id,
          title: l.title,
          summary: l.summary,
          position: l.position,
          durationMin: l.duration_min,
          status: l.status ?? 'not_started',
          percent: l.percent ?? 0,
        })),
    })),
    skills: skills.map((s) => ({ id: s.id, subjectId: s.subject_id, name: s.name, description: s.description })),
    quizzes: quizzes.map((z) => ({ id: z.id, title: z.title, description: z.description, questionCount: z.question_count, timeLimitMin: z.time_limit_min })),
  };
}

export function getLessonTranslation(lessonId: string, language: LanguageCode): LessonTranslation | null {
  if (language === 'en') return null;
  const row = q.get<{ title: string; summary: string; content_md: string; key_points_json: string }>(
    'SELECT title, summary, content_md, key_points_json FROM lesson_translations WHERE lesson_id = ? AND language = ?',
    lessonId,
    language,
  );
  if (!row) {
    const base = q.get<{ title: string; summary: string; content_md: string; key_points_json: string }>(
      'SELECT title, summary, content_md, key_points_json FROM lessons WHERE id = ?',
      lessonId,
    );
    if (!base) return null;
    return {
      language,
      title: base.title,
      summary: base.summary,
      contentMd: base.content_md,
      keyPoints: parseJson<string[]>(base.key_points_json, []),
      status: 'fallback',
    };
  }
  return {
    language,
    title: row.title,
    summary: row.summary,
    contentMd: row.content_md,
    keyPoints: parseJson<string[]>(row.key_points_json, []),
    status: 'available',
  };
}

export function getLessonDetail(lessonId: string, studentId: string | null, language: LanguageCode = 'en'): Lesson {
  const row = q.get<{
    id: string;
    module_id: string;
    title: string;
    summary: string;
    content_md: string;
    key_points_json: string;
    tutor_json: string;
    position: number;
    duration_min: number;
    course_id: string;
    course_title: string;
    subject_id: string;
    subject_name: string;
    status: ProgressStatus | null;
    percent: number | null;
  }>(
    `SELECT l.*, c.id AS course_id, c.title AS course_title, s.id AS subject_id, s.name AS subject_name, p.status, p.percent
       FROM lessons l JOIN modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id JOIN subjects s ON s.id = c.subject_id
       LEFT JOIN progress p ON p.lesson_id = l.id AND p.student_id = ?
      WHERE l.id = ?`,
    studentId ?? '',
    lessonId,
  );
  if (!row) throw notFound('Lesson');
  const skills = q.all<Skill & { subject_id: string }>(
    'SELECT s.id, s.subject_id, s.name, s.description FROM skills s JOIN lesson_skills ls ON ls.skill_id = s.id WHERE ls.lesson_id = ?',
    lessonId,
  );
  const practice = q.get<{ id: string }>("SELECT id FROM assessments WHERE lesson_id = ? AND type = 'practice' LIMIT 1", lessonId);
  const ordered = q.all<{ id: string }>(
    `SELECT l.id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = ? ORDER BY m.position, l.position`,
    row.course_id,
  );
  const idx = ordered.findIndex((l) => l.id === lessonId);
  const skillIds = skills.map((s) => s.id);
  const resources = skillIds.length ? listResources({ skillIds }).slice(0, 4) : [];
  const tutor = parseJson<Partial<TutorNotes>>(row.tutor_json, {});
  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    summary: row.summary,
    contentMd: row.content_md,
    keyPoints: parseJson<string[]>(row.key_points_json, []),
    tutorNotes: {
      simpler: tutor.simpler ?? '',
      example: tutor.example ?? '',
      misconceptions: tutor.misconceptions ?? [],
      glossary: tutor.glossary ?? {},
    },
    position: row.position,
    durationMin: row.duration_min,
    status: row.status ?? 'not_started',
    percent: row.percent ?? 0,
    skills: skills.map((s) => ({ id: s.id, subjectId: s.subject_id, name: s.name, description: s.description })),
    translation: getLessonTranslation(lessonId, language),
    courseId: row.course_id,
    courseTitle: row.course_title,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    practiceAssessmentId: practice?.id ?? null,
    resources,
    nextLessonId: idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].id : null,
    prevLessonId: idx > 0 ? ordered[idx - 1].id : null,
  };
}

export function listResources(filter: { subjectId?: string; skillIds?: string[]; query?: string; language?: LanguageCode; limit?: number } = {}): LearningResource[] {
  const clauses: string[] = ['1 = 1'];
  const params: unknown[] = [];
  if (filter.subjectId) {
    clauses.push('r.subject_id = ?');
    params.push(filter.subjectId);
  }
  if (filter.skillIds && filter.skillIds.length) {
    clauses.push(`r.skill_id IN (${filter.skillIds.map(() => '?').join(',')})`);
    params.push(...filter.skillIds);
  }
  if (filter.query) {
    clauses.push('(r.title LIKE ? OR r.description LIKE ? OR r.source LIKE ?)');
    const like = `%${filter.query}%`;
    params.push(like, like, like);
  }
  if (filter.language) {
    clauses.push('r.language = ?');
    params.push(filter.language);
  }
  params.push(filter.limit ?? 50);
  return q
    .all<{
      id: string;
      title: string;
      type: LearningResource['type'];
      url: string;
      source: string;
      subject_id: string | null;
      skill_id: string | null;
      language: LanguageCode;
      description: string;
      is_demo: number;
      attribution: string;
      duration_min: number | null;
    }>(`SELECT r.* FROM learning_resources r WHERE ${clauses.join(' AND ')} ORDER BY r.title LIMIT ?`, ...params)
    .map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      url: r.url,
      source: r.source,
      subjectId: r.subject_id,
      skillId: r.skill_id,
      language: r.language,
      description: r.description,
      isDemo: r.is_demo === 1,
      attribution: r.attribution,
      durationMin: r.duration_min,
    }));
}

export function getResource(id: string): LearningResource | undefined {
  return listResources({ limit: 1000 }).find((r) => r.id === id);
}

export function listSkills(subjectId?: string): Skill[] {
  return q
    .all<{ id: string; subject_id: string; name: string; description: string }>(
      'SELECT * FROM skills WHERE (? IS NULL OR subject_id = ?) ORDER BY subject_id, name',
      subjectId ?? null,
      subjectId ?? null,
    )
    .map((s) => ({ id: s.id, subjectId: s.subject_id, name: s.name, description: s.description }));
}
