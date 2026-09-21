/**
 * Seeds SYNTHETIC demo data. Every user, class, attempt and project here is fictional.
 * Idempotent: skips if the demo admin already exists (unless `force`).
 */
import { q, tx, nowIso, parseJson } from './index.js';
import { hashPasswordSync } from '../lib/auth.js';
import { newId } from '../lib/http.js';
import { courses, courseQuizzes, questions, resources, skills, subjects, translations } from './seed-content.js';
import { submitAttempt } from '../services/assessment.js';
import { touchLessonProgress, logActivity } from '../services/progress.js';
import { regenerateRecommendations } from '../services/adaptive.js';
import type { AttemptAnswer } from '@shared/types';

export const DEMO_PASSWORD = 'Demo@1234';
export const DEMO_ACCOUNTS = {
  student: { id: 'usr_student_demo', email: 'student@demo.aieses', name: 'Aarav Demo' },
  teacher: { id: 'usr_teacher_demo', email: 'teacher@demo.aieses', name: 'Priya Sharma' },
  admin: { id: 'usr_admin_demo', email: 'admin@demo.aieses', name: 'Admin Demo' },
} as const;

/** Small deterministic PRNG so the demo data is identical on every boot. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLORS = ['#2563eb', '#16a34a', '#7c3aed', '#ea580c', '#db2777', '#0891b2', '#ca8a04', '#dc2626'];

const STUDENTS_6A = [
  ['usr_s_ananya', 'Ananya Iyer', 0.85],
  ['usr_s_rohan', 'Rohan Mehta', 0.55],
  ['usr_s_sneha', 'Sneha Patil', 0.7],
  ['usr_s_kabir', 'Kabir Singh', 0.4],
  ['usr_s_diya', 'Diya Nair', 0.9],
  ['usr_s_arjun', 'Arjun Reddy', 0.5],
  ['usr_s_fatima', 'Fatima Khan', 0.75],
] as const;

const STUDENTS_8B = [
  ['usr_s_ishaan', 'Ishaan Gupta', 0.8],
  ['usr_s_meera', 'Meera Joshi', 0.6],
  ['usr_s_vivaan', 'Vivaan Das', 0.45],
  ['usr_s_tara', 'Tara Bose', 0.9],
  ['usr_s_yash', 'Yash Kulkarni', 0.35],
] as const;

export function isSeeded(): boolean {
  return !!q.get('SELECT 1 FROM users WHERE id = ?', DEMO_ACCOUNTS.admin.id);
}

export function seed(opts: { force?: boolean; quiet?: boolean } = {}): { seeded: boolean } {
  if (isSeeded() && !opts.force) return { seeded: false };
  const log = (msg: string) => {
    if (!opts.quiet) console.log(`[seed] ${msg}`);
  };
  const rand = mulberry32(26207);
  const passwordHash = hashPasswordSync(DEMO_PASSWORD);
  const now = new Date();
  const daysAgo = (d: number, hour = 10) => {
    const dt = new Date(now.getTime() - d * 86400000);
    dt.setUTCHours(hour, Math.floor(rand() * 59), 0, 0);
    return dt.toISOString();
  };

  tx(() => {
    if (opts.force) {
      for (const table of [
        'activity_log', 'code_executions', 'ai_messages', 'ai_conversations', 'files', 'documents', 'projects', 'submissions',
        'assignments', 'recommendations', 'student_skills', 'progress', 'attempts', 'assessment_questions', 'assessments',
        'questions', 'learning_resources', 'lesson_skills', 'skills', 'lesson_translations', 'lessons', 'modules', 'courses',
        'subjects', 'class_students', 'classes', 'teacher_profiles', 'student_profiles', 'users',
      ]) {
        q.run(`DELETE FROM ${table}`);
      }
    }

    // ---- Users -------------------------------------------------------------
    const createdAt = daysAgo(30);
    const insertUser = (id: string, email: string, name: string, role: string, color: string, language = 'en') =>
      q.run(
        'INSERT INTO users (id, email, password_hash, name, role, language, avatar_color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        id, email, passwordHash, name, role, language, color, createdAt,
      );

    insertUser(DEMO_ACCOUNTS.admin.id, DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.name, 'admin', '#0f172a');
    insertUser(DEMO_ACCOUNTS.teacher.id, DEMO_ACCOUNTS.teacher.email, DEMO_ACCOUNTS.teacher.name, 'teacher', '#7c3aed');
    insertUser('usr_teacher_rahul', 'rahul.verma@demo.aieses', 'Rahul Verma', 'teacher', '#0891b2');
    q.run('INSERT INTO teacher_profiles (user_id, school, subjects_json) VALUES (?, ?, ?)', DEMO_ACCOUNTS.teacher.id, 'Govt. Model School, Pune (demo)', JSON.stringify(['math', 'science']));
    q.run('INSERT INTO teacher_profiles (user_id, school, subjects_json) VALUES (?, ?, ?)', 'usr_teacher_rahul', 'Govt. Model School, Pune (demo)', JSON.stringify(['cs']));

    insertUser(DEMO_ACCOUNTS.student.id, DEMO_ACCOUNTS.student.email, DEMO_ACCOUNTS.student.name, 'student', '#2563eb');
    q.run('INSERT INTO student_profiles (user_id, grade, school, bio, points, streak_days) VALUES (?, 6, ?, ?, 0, 0)', DEMO_ACCOUNTS.student.id, 'Govt. Model School, Pune (demo)', 'Loves cricket and science experiments.');

    const allStudents: { id: string; name: string; ability: number; grade: number }[] = [
      { id: DEMO_ACCOUNTS.student.id, name: DEMO_ACCOUNTS.student.name, ability: 0.65, grade: 6 },
    ];
    STUDENTS_6A.forEach(([id, name, ability], i) => {
      insertUser(id, `${id.replace('usr_s_', '')}@demo.aieses`, name, 'student', COLORS[i % COLORS.length]);
      q.run('INSERT INTO student_profiles (user_id, grade, school, points, streak_days) VALUES (?, 6, ?, 0, 0)', id, 'Govt. Model School, Pune (demo)');
      allStudents.push({ id, name, ability, grade: 6 });
    });
    STUDENTS_8B.forEach(([id, name, ability], i) => {
      insertUser(id, `${id.replace('usr_s_', '')}@demo.aieses`, name, 'student', COLORS[(i + 3) % COLORS.length]);
      q.run('INSERT INTO student_profiles (user_id, grade, school, points, streak_days) VALUES (?, 8, ?, 0, 0)', id, 'Govt. Model School, Pune (demo)');
      allStudents.push({ id, name, ability, grade: 8 });
    });

    // ---- Classes -----------------------------------------------------------
    q.run('INSERT INTO classes (id, name, grade, teacher_id, join_code, created_at) VALUES (?, ?, ?, ?, ?, ?)', 'cls_6a', 'Class 6A — Maths & Science', 6, DEMO_ACCOUNTS.teacher.id, 'AIESES6A', createdAt);
    q.run('INSERT INTO classes (id, name, grade, teacher_id, join_code, created_at) VALUES (?, ?, ?, ?, ?, ?)', 'cls_8b', 'Class 8B — Coding Club', 8, 'usr_teacher_rahul', 'AIESES8B', createdAt);
    for (const s of allStudents) {
      q.run('INSERT INTO class_students (class_id, student_id, joined_at) VALUES (?, ?, ?)', s.grade === 6 ? 'cls_6a' : 'cls_8b', s.id, createdAt);
    }
    // The demo student also attends the coding club so the CS journey is visible.
    q.run('INSERT INTO class_students (class_id, student_id, joined_at) VALUES (?, ?, ?)', 'cls_8b', DEMO_ACCOUNTS.student.id, createdAt);

    // ---- Curriculum --------------------------------------------------------
    for (const s of subjects) q.run('INSERT INTO subjects (id, name, icon, color, description) VALUES (?, ?, ?, ?, ?)', s.id, s.name, s.icon, s.color, s.description);
    for (const s of skills) q.run('INSERT INTO skills (id, subject_id, name, description) VALUES (?, ?, ?, ?)', s.id, s.subjectId, s.name, s.description);
    for (const c of courses) {
      q.run(
        'INSERT INTO courses (id, subject_id, title, description, grade, level, estimated_hours, color, is_published, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
        c.id, c.subjectId, c.title, c.description, c.grade, c.level, c.estimatedHours, c.color, DEMO_ACCOUNTS.teacher.id,
      );
      c.modules.forEach((m, mi) => {
        q.run('INSERT INTO modules (id, course_id, title, description, position) VALUES (?, ?, ?, ?, ?)', m.id, c.id, m.title, m.description, mi);
        m.lessons.forEach((l, li) => {
          q.run(
            'INSERT INTO lessons (id, module_id, title, summary, content_md, key_points_json, tutor_json, position, duration_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            l.id, m.id, l.title, l.summary, l.contentMd, JSON.stringify(l.keyPoints), JSON.stringify(l.tutor), li, l.durationMin,
          );
          for (const sk of l.skills) q.run('INSERT INTO lesson_skills (lesson_id, skill_id) VALUES (?, ?)', l.id, sk);
          // Per-lesson practice set
          const lessonQuestions = questions.filter((qu) => qu.lessonId === l.id);
          if (lessonQuestions.length) {
            const asmId = `prac-${l.id}`;
            q.run(
              "INSERT INTO assessments (id, course_id, lesson_id, title, description, type, time_limit_min, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'practice', NULL, ?, ?)",
              asmId, c.id, l.id, `Practice: ${l.title}`, `Adaptive practice questions for “${l.title}”.`, DEMO_ACCOUNTS.teacher.id, createdAt,
            );
            l.practiceId = asmId;
          }
        });
      });
    }
    for (const t of translations) {
      q.run(
        'INSERT INTO lesson_translations (lesson_id, language, title, summary, content_md, key_points_json) VALUES (?, ?, ?, ?, ?, ?)',
        t.lessonId, t.language, t.title, t.summary, t.contentMd, JSON.stringify(t.keyPoints),
      );
    }
    for (const qu of questions) {
      q.run(
        "INSERT INTO questions (id, lesson_id, skill_id, type, prompt, options_json, answer_key_json, explanation, difficulty, points, created_by) VALUES (?, ?, ?, 'mcq', ?, ?, ?, ?, ?, 1, ?)",
        qu.id, qu.lessonId, qu.skillId, qu.prompt, JSON.stringify(qu.options), JSON.stringify({ index: qu.answer }), qu.explanation, qu.difficulty, DEMO_ACCOUNTS.teacher.id,
      );
    }
    // Attach questions to per-lesson practice sets
    const byLesson = new Map<string, typeof questions>();
    for (const qu of questions) byLesson.set(qu.lessonId, [...(byLesson.get(qu.lessonId) ?? []), qu]);
    for (const [lessonId, qs] of byLesson) {
      qs.forEach((qu, i) => q.run('INSERT INTO assessment_questions (assessment_id, question_id, position, points) VALUES (?, ?, ?, 1)', `prac-${lessonId}`, qu.id, i));
    }
    for (const z of courseQuizzes) {
      q.run(
        "INSERT INTO assessments (id, course_id, lesson_id, title, description, type, time_limit_min, created_by, created_at) VALUES (?, ?, NULL, ?, ?, 'quiz', ?, ?, ?)",
        z.id, z.courseId, z.title, z.description, z.timeLimitMin, DEMO_ACCOUNTS.teacher.id, createdAt,
      );
      z.questionIds.forEach((qid, i) => q.run('INSERT INTO assessment_questions (assessment_id, question_id, position, points) VALUES (?, ?, ?, 1)', z.id, qid, i));
    }
    for (const r of resources) {
      q.run(
        'INSERT INTO learning_resources (id, title, type, url, source, subject_id, skill_id, language, description, is_demo, attribution, duration_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        r.id, r.title, r.type, r.url, r.source, r.subjectId, r.skillId, r.language, r.description,
        `Demo catalogue entry linking to an openly available resource from ${r.source}. Availability of the external page is not guaranteed.`, r.durationMin,
      );
    }
    log(`curriculum: ${subjects.length} subjects, ${courses.length} courses, ${questions.length} questions, ${resources.length} resources`);

    // ---- Historical learning activity (synthetic) ---------------------------
    const lessonsByCourse = courses.map((c) => ({ courseId: c.id, grade: c.grade, lessons: c.modules.flatMap((m) => m.lessons) }));
    const optionsById = new Map(questions.map((qu) => [qu.id, qu]));

    const simulateAttempt = (studentId: string, ability: number, assessmentId: string, at: string) => {
      const qids = q.all<{ question_id: string }>('SELECT question_id FROM assessment_questions WHERE assessment_id = ? ORDER BY position', assessmentId).map((r) => r.question_id);
      const answers: AttemptAnswer[] = qids.slice(0, 5).map((qid) => {
        const qu = optionsById.get(qid)!;
        const pCorrect = Math.min(0.97, Math.max(0.1, ability - (qu.difficulty - 1) * 0.15));
        let idx = qu.answer;
        if (rand() > pCorrect) {
          const wrong = qu.options.map((_, i) => i).filter((i) => i !== qu.answer);
          idx = wrong[Math.floor(rand() * wrong.length)];
        }
        return { questionId: qid, answer: idx };
      });
      submitAttempt(assessmentId, studentId, answers, at);
    };

    for (const s of allStudents) {
      const isDemo = s.id === DEMO_ACCOUNTS.student.id;
      const track = lessonsByCourse.filter((c) => c.grade === s.grade || (isDemo && c.courseId === 'course-cs-python'));
      let day = 13;
      for (const course of track) {
        const lessonsToDo = isDemo
          ? course.courseId === 'course-math6-fractions' ? 2 : course.courseId === 'course-sci6-light' ? 1 : 1
          : Math.min(course.lessons.length, 1 + Math.floor(rand() * (1 + s.ability * course.lessons.length)));
        for (let i = 0; i < lessonsToDo && day >= 0; i++) {
          const lesson = course.lessons[i];
          const at = daysAgo(day, 9 + Math.floor(rand() * 8));
          touchLessonProgress(s.id, lesson.id, 'in_progress', at, 40);
          if (lesson.practiceId) {
            // The demo student is left with a visible weak area in equivalent fractions.
            const ability = isDemo && lesson.id === 'les-frac-equivalent' ? 0.25 : isDemo ? 0.85 : s.ability;
            simulateAttempt(s.id, ability, lesson.practiceId, daysAgo(day, 17));
          } else {
            touchLessonProgress(s.id, lesson.id, 'completed', at);
          }
          day -= isDemo ? 3 : 1 + Math.floor(rand() * 2);
        }
      }
      // Course checkpoint quizzes for stronger / more active students
      if (!isDemo && s.ability >= 0.5 && rand() < 0.8) {
        const quiz = courseQuizzes.find((z) => track.some((t) => t.courseId === z.courseId));
        if (quiz) simulateAttempt(s.id, s.ability, quiz.id, daysAgo(Math.max(0, day), 18));
      }
      // Make sure inactive-looking students exist too (Kabir & Yash had no activity in the last week).
      regenerateRecommendations(s.id);
    }
    // Keep a couple of students "inactive" for the at-risk analytics view.
    for (const inactive of ['usr_s_kabir', 'usr_s_yash']) {
      q.run("UPDATE activity_log SET created_at = ? WHERE user_id = ? AND created_at > ?", daysAgo(9), inactive, daysAgo(8));
      q.run('UPDATE progress SET last_accessed_at = ? WHERE student_id = ? AND last_accessed_at > ?', daysAgo(9), inactive, daysAgo(8));
      q.run('UPDATE attempts SET submitted_at = ?, started_at = ? WHERE student_id = ? AND submitted_at > ?', daysAgo(9), daysAgo(9), inactive, daysAgo(8));
    }
    log(`activity: ${q.count('SELECT COUNT(*) FROM attempts')} attempts, ${q.count('SELECT COUNT(*) FROM progress')} progress rows`);

    // ---- Assignments -------------------------------------------------------
    const dueSoon = new Date(now.getTime() + 3 * 86400000).toISOString();
    q.run(
      "INSERT INTO assignments (id, class_id, teacher_id, title, description, type, assessment_id, due_at, created_at) VALUES (?, 'cls_6a', ?, ?, ?, 'assessment', ?, ?, ?)",
      'asg_frac_quiz', DEMO_ACCOUNTS.teacher.id, 'Fractions Checkpoint Quiz', 'Complete the checkpoint quiz after finishing the Understanding Fractions module.', 'quiz-fractions-checkpoint', dueSoon, daysAgo(4),
    );
    q.run(
      "INSERT INTO assignments (id, class_id, teacher_id, title, description, type, assessment_id, due_at, created_at) VALUES (?, 'cls_6a', ?, ?, ?, 'project', NULL, ?, ?)",
      'asg_light_project', DEMO_ACCOUNTS.teacher.id, 'Project: Shadows Around Me', 'Write a one-page report (with a drawing or table) on how shadow length changes during the day. Export it as PDF and submit.', new Date(now.getTime() + 6 * 86400000).toISOString(), daysAgo(3),
    );
    q.run(
      "INSERT INTO assignments (id, class_id, teacher_id, title, description, type, assessment_id, due_at, created_at) VALUES (?, 'cls_8b', ?, ?, ?, 'project', NULL, ?, ?)",
      'asg_py_project', 'usr_teacher_rahul', 'Mini Project: Marks Calculator', 'Write a Python program that reads five marks, prints the total, average and the grade. Submit from the IDE.', new Date(now.getTime() + 5 * 86400000).toISOString(), daysAgo(2),
    );
    // A few students already submitted the quiz assignment via attempts
    for (const sid of ['usr_s_ananya', 'usr_s_diya', 'usr_s_sneha']) {
      const att = q.get<{ id: string }>("SELECT id FROM attempts WHERE student_id = ? AND assessment_id = 'quiz-fractions-checkpoint' LIMIT 1", sid);
      if (att) {
        q.run(
          "INSERT INTO submissions (id, assignment_id, student_id, project_id, attempt_id, content, status, grade, feedback, submitted_at) VALUES (?, 'asg_frac_quiz', ?, NULL, ?, 'Quiz attempt submitted', 'submitted', NULL, NULL, ?)",
          newId('sub'), sid, att.id, daysAgo(2),
        );
      }
    }

    // ---- Demo student workspace -------------------------------------------
    const projId = 'prj_demo_notes';
    q.run(
      "INSERT INTO projects (id, owner_id, title, description, type, class_id, assignment_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'mixed', 'cls_6a', NULL, 'draft', ?, ?)",
      projId, DEMO_ACCOUNTS.student.id, 'My Science Notes', 'Notes and experiments from the Light & Shadows course.', daysAgo(5), daysAgo(1),
    );
    q.run(
      "INSERT INTO documents (id, project_id, owner_id, title, format, content, language, created_at, updated_at) VALUES (?, ?, ?, ?, 'markdown', ?, 'en', ?, ?)",
      'doc_demo_shadows', projId, DEMO_ACCOUNTS.student.id, 'Shadow Length Experiment',
      `# Shadow Length Experiment\n\n**Question:** How does the length of a shadow change during the day?\n\n## Method\n\n1. Fixed a 30 cm stick upright in the playground.\n2. Measured the shadow every hour from 9 am to 3 pm.\n\n## Observations\n\n| Time | Shadow length (cm) |\n|---|---|\n| 9:00 am | 62 |\n| 11:00 am | 31 |\n| 12:30 pm | 18 |\n| 3:00 pm | 55 |\n\n## Conclusion\n\nThe shadow is **longest in the morning and evening** and **shortest around noon**, because the Sun is highest in the sky at noon.\n\n> Next step: repeat the experiment in winter and compare.\n`,
      daysAgo(5), daysAgo(1),
    );
    q.run(
      "INSERT INTO files (id, project_id, owner_id, name, language, content, size, created_at, updated_at) VALUES (?, ?, ?, ?, 'python', ?, ?, ?, ?)",
      'file_demo_marks', projId, DEMO_ACCOUNTS.student.id, 'marks_calculator.py',
      `# Marks calculator — runs in the AIESES sandbox\nmarks = [78, 92, 65, 88, 71]\n\ntotal = sum(marks)\naverage = total / len(marks)\n\nprint("Total:", total)\nprint("Average:", round(average, 1))\n\nif average >= 90:\n    print("Grade: A")\nelif average >= 75:\n    print("Grade: B")\nelse:\n    print("Grade: C")\n`,
      0, daysAgo(2), daysAgo(2),
    );
    q.run(
      "INSERT INTO files (id, project_id, owner_id, name, language, content, size, created_at, updated_at) VALUES (?, ?, ?, ?, 'javascript', ?, ?, ?, ?)",
      'file_demo_fractions_js', projId, DEMO_ACCOUNTS.student.id, 'fractions.js',
      `// Equivalent fraction checker — runs in your browser's Web Worker sandbox\nfunction areEquivalent(a, b, c, d) {\n  return a * d === b * c;\n}\n\nconsole.log("1/2 and 2/4 equivalent?", areEquivalent(1, 2, 2, 4));\nconsole.log("1/2 and 2/3 equivalent?", areEquivalent(1, 2, 2, 3));\n\nconst pairs = [[3, 5, 9, 15], [2, 3, 4, 5]];\nfor (const [a, b, c, d] of pairs) {\n  console.log(\`\${a}/\${b} = \${c}/\${d}?\`, areEquivalent(a, b, c, d));\n}\n`,
      0, daysAgo(2), daysAgo(2),
    );
    q.run('UPDATE files SET size = length(content)');

    // Sample AI conversation for the demo student
    const convId = 'conv_demo_1';
    q.run("INSERT INTO ai_conversations (id, user_id, title, context_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", convId, DEMO_ACCOUNTS.student.id, 'Equivalent Fractions', JSON.stringify({ lessonId: 'les-frac-equivalent' }), daysAgo(3), daysAgo(3));
    q.run("INSERT INTO ai_messages (id, conversation_id, role, content, intent, provider, meta_json, created_at) VALUES (?, ?, 'user', ?, NULL, NULL, '{}', ?)", newId('msg'), convId, 'Why is 2/4 the same as 1/2?', daysAgo(3));
    q.run("INSERT INTO ai_messages (id, conversation_id, role, content, intent, provider, meta_json, created_at) VALUES (?, ?, 'assistant', ?, 'explain', 'demo', ?, ?)", newId('msg'), convId,
      'Cutting each half of a roti into two pieces gives 4 pieces — you still hold the same amount, now called 2/4. Multiplying the numerator and denominator by the same number keeps the value equal.',
      JSON.stringify({ providerLabel: 'Demo Tutor (curriculum-grounded, offline)' }), daysAgo(3));

    for (const s of allStudents) logActivity(s.id, 'seed', null, daysAgo(14));
  });

  log('done');
  return { seeded: true };
}

export function ensureSeeded(): void {
  if (!isSeeded()) seed({ quiet: false });
}

/** Utility for tests: fetch the practice assessment id of a lesson. */
export function practiceIdFor(lessonId: string): string | undefined {
  return q.get<{ id: string }>("SELECT id FROM assessments WHERE lesson_id = ? AND type = 'practice'", lessonId)?.id;
}

export { parseJson, nowIso };
