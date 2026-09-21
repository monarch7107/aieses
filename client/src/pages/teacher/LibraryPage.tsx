import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Markdown } from '@/lib/markdown';
import { Badge, Card, CardBody, CardHeader, ErrorState, PageHeader, Spinner } from '@/components/ui';
import type { Assessment, Course, Lesson, Module, Skill } from '@shared/types';

type CourseDetail = Course & { modules: Module[]; skills: Skill[]; quizzes: { id: string; title: string; questionCount: number }[] };
type TeacherQuestion = { id: string; prompt: string; options: string[] | null; answerKey: { index?: number; text?: string; accept?: string[] }; explanation: string; difficulty: number; skillId: string; skillName: string };
type TeacherAssessment = Omit<Assessment, 'questions'> & { questions: TeacherQuestion[] };

/** Teacher view of the curriculum: browse lessons and review assessments with answer keys. */
export function TeacherLibraryPage() {
  const { t } = useI18n();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => get<{ courses: Course[] }>('/courses').then((r) => r.courses) });
  const course = useQuery({ queryKey: ['course', courseId], queryFn: () => get<{ course: CourseDetail }>(`/courses/${courseId}`).then((r) => r.course), enabled: !!courseId });
  const lesson = useQuery({ queryKey: ['lesson', lessonId, 'en'], queryFn: () => get<{ lesson: Lesson }>(`/lessons/${lessonId}`).then((r) => r.lesson), enabled: !!lessonId });
  const assessment = useQuery({
    queryKey: ['assessment-teacher', assessmentId],
    queryFn: () => get<{ assessment: TeacherAssessment }>(`/assessments/${assessmentId}`).then((r) => r.assessment),
    enabled: !!assessmentId,
  });

  if (courses.isLoading) return <Spinner />;
  if (courses.isError) return <ErrorState error={courses.error} onRetry={() => courses.refetch()} />;
  const selected = courseId ?? courses.data?.[0]?.id ?? null;
  if (selected && selected !== courseId) setCourseId(selected);

  return (
    <div>
      <PageHeader title={t('courses')} subtitle="Curriculum library — preview lessons and review assessment answer keys before assigning." />
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="space-y-2">
          {courses.data?.map((c) => (
            <button key={c.id} type="button" onClick={() => { setCourseId(c.id); setLessonId(null); setAssessmentId(null); }} className={`w-full rounded-lg border p-3 text-left text-sm ${courseId === c.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <span className="block font-semibold text-slate-900">{c.title}</span>
              <span className="text-xs text-slate-500">
                {c.subjectName} · Grade {c.grade} · {c.lessonCount} lessons
              </span>
            </button>
          ))}
        </div>
        <div className="lg:col-span-1">
          {course.isLoading && <Spinner />}
          {course.data && (
            <Card>
              <CardHeader title="Lessons & assessments" />
              <div className="max-h-[36rem] overflow-y-auto">
                {course.data.modules.map((m) => (
                  <div key={m.id}>
                    <p className="bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase text-slate-500">{m.title}</p>
                    {(m.lessons ?? []).map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-2 px-4 py-1.5 text-sm">
                        <button type="button" onClick={() => { setLessonId(l.id); setAssessmentId(null); }} className={`truncate text-left hover:text-brand-800 ${lessonId === l.id ? 'font-semibold text-brand-800' : 'text-slate-800'}`}>
                          {l.title}
                        </button>
                        <button type="button" onClick={() => { setAssessmentId(`prac-${l.id}`); setLessonId(null); }} className="shrink-0 text-xs text-brand-700 hover:underline">
                          practice
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
                <p className="bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase text-slate-500">Quizzes</p>
                {course.data.quizzes.map((qz) => (
                  <button key={qz.id} type="button" onClick={() => { setAssessmentId(qz.id); setLessonId(null); }} className={`block w-full px-4 py-1.5 text-left text-sm hover:text-brand-800 ${assessmentId === qz.id ? 'font-semibold text-brand-800' : 'text-slate-800'}`}>
                    {qz.title} <span className="text-xs text-slate-400">({qz.questionCount} q)</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
        <div className="lg:col-span-2">
          {!lessonId && !assessmentId && <Card className="p-8 text-center text-sm text-slate-500">Select a lesson or assessment to preview it.</Card>}
          {lesson.isLoading && <Spinner />}
          {lessonId && lesson.data && (
            <Card>
              <CardHeader title={lesson.data.title} subtitle={lesson.data.summary} action={<Badge>{lesson.data.durationMin} min</Badge>} />
              <CardBody>
                <Markdown content={lesson.data.contentMd} />
                <div className="mt-4 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
                  <p className="font-semibold">Tutor notes (used by the AI tutor)</p>
                  <p className="mt-1">
                    <span className="font-medium">Simpler:</span> {lesson.data.tutorNotes.simpler}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium">Example:</span> {lesson.data.tutorNotes.example}
                  </p>
                  {lesson.data.tutorNotes.misconceptions.length > 0 && (
                    <p className="mt-1">
                      <span className="font-medium">Misconceptions:</span> {lesson.data.tutorNotes.misconceptions.join(' · ')}
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
          )}
          {assessment.isLoading && <Spinner />}
          {assessmentId && assessment.data && (
            <Card>
              <CardHeader title={assessment.data.title} subtitle={`${assessment.data.description} · answer keys visible to teachers only`} action={<Badge tone="info">{assessment.data.type}</Badge>} />
              <ol className="divide-y divide-slate-100">
                {assessment.data.questions.map((qn, i) => (
                  <li key={qn.id} className="px-5 py-3 text-sm">
                    <p className="font-medium text-slate-900">
                      {i + 1}. {qn.prompt}
                    </p>
                    {qn.options && (
                      <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                        {qn.options.map((o, oi) => (
                          <li key={oi} className={`rounded px-2 py-0.5 text-xs ${qn.answerKey?.index === oi ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-slate-600'}`}>
                            {String.fromCharCode(65 + oi)}. {o}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!qn.options && qn.answerKey?.text && <p className="mt-1 text-xs text-emerald-800">Answer: {qn.answerKey.text}</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      Skill: {qn.skillName} · difficulty {qn.difficulty} · {qn.explanation}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
