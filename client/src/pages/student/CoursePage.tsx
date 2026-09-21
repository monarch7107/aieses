import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, ClipboardCheck, Clock, PlayCircle } from 'lucide-react';
import { get } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Badge, Card, CardBody, CardHeader, ErrorState, LinkButton, PageHeader, ProgressBar, Spinner } from '@/components/ui';
import type { Course, Module, Skill } from '@shared/types';

type CourseDetail = Course & { modules: Module[]; skills: Skill[]; quizzes: { id: string; title: string; description: string; questionCount: number; timeLimitMin: number | null }[] };

export function CoursePage() {
  const { id } = useParams();
  const { t } = useI18n();
  const course = useQuery({ queryKey: ['course', id], queryFn: () => get<{ course: CourseDetail }>(`/courses/${id}`).then((r) => r.course), enabled: !!id });
  if (course.isLoading) return <Spinner />;
  if (course.isError) return <ErrorState error={course.error} onRetry={() => course.refetch()} />;
  const c = course.data!;
  const allLessons = c.modules.flatMap((m) => m.lessons ?? []);
  const nextLesson = allLessons.find((l) => l.status !== 'completed') ?? allLessons[0];

  return (
    <div>
      <PageHeader
        crumbs={[{ to: '/subjects', label: t('subjects') }, { label: c.subjectName ?? '' }, { label: c.title }]}
        title={c.title}
        subtitle={c.description}
        actions={
          nextLesson && (
            <LinkButton to={`/lessons/${nextLesson.id}`} icon={<PlayCircle className="h-4 w-4" />}>
              {(c.completedLessons ?? 0) > 0 ? t('continueLearning') : t('startLesson')}
            </LinkButton>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {c.modules.map((m, mi) => (
            <Card key={m.id}>
              <CardHeader title={`Module ${mi + 1}: ${m.title}`} subtitle={m.description} />
              <ul className="divide-y divide-slate-100">
                {(m.lessons ?? []).map((l, li) => (
                  <li key={l.id}>
                    <Link to={`/lessons/${l.id}`} className="flex items-center gap-4 px-5 py-3 transition hover:bg-slate-50">
                      {l.status === 'completed' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : l.status === 'in_progress' ? <PlayCircle className="h-5 w-5 shrink-0 text-brand-600" /> : <Circle className="h-5 w-5 shrink-0 text-slate-300" />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900">
                          {mi + 1}.{li + 1} {l.title}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{l.summary}</span>
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" /> {l.durationMin} {t('minutes')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('progress')}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{c.percent ?? 0}%</p>
            <ProgressBar value={c.percent ?? 0} className="mt-2" />
            <p className="mt-2 text-xs text-slate-500">
              {c.completedLessons ?? 0} of {c.lessonCount ?? 0} lessons · {c.estimatedHours} h · <Badge>{c.level}</Badge>
            </p>
          </Card>
          <Card>
            <CardHeader title={t('quizzes')} subtitle="Checkpoint assessments" />
            <CardBody className="space-y-2">
              {c.quizzes.map((qz) => (
                <Link key={qz.id} to={`/assessments/${qz.id}`} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-brand-300">
                  <ClipboardCheck className="mt-0.5 h-4 w-4 text-brand-600" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{qz.title}</span>
                    <span className="text-xs text-slate-500">
                      {qz.questionCount} questions{qz.timeLimitMin ? ` · ${qz.timeLimitMin} min` : ''}
                    </span>
                  </span>
                </Link>
              ))}
              {c.quizzes.length === 0 && <p className="text-sm text-slate-500">{t('noData')}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t('skills')} subtitle="Skills tracked by the adaptive engine" />
            <CardBody className="flex flex-wrap gap-2">
              {c.skills.map((s) => (
                <Badge key={s.id} tone="neutral" title={s.description}>
                  {s.name}
                </Badge>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
