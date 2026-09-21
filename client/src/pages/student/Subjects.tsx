import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { get } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Badge, Card, ErrorState, PageHeader, ProgressBar, Skeleton } from '@/components/ui';
import type { Course, Subject } from '@shared/types';

export function SubjectsPage() {
  const { t } = useI18n();
  const [active, setActive] = useState<string | null>(null);
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => get<{ subjects: Subject[] }>('/subjects').then((r) => r.subjects) });
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => get<{ courses: Course[] }>('/courses').then((r) => r.courses) });

  if (subjects.isError) return <ErrorState error={subjects.error} onRetry={() => subjects.refetch()} />;
  const list = (courses.data ?? []).filter((c) => !active || c.subjectId === active);

  return (
    <div>
      <PageHeader title={t('subjects')} subtitle="Curriculum-aligned courses for Grade 6–8 (English · हिन्दी · தமிழ் where translated)" />
      <div className="mb-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => setActive(null)} className={cn('rounded-full px-4 py-1.5 text-sm font-medium ring-1 transition', !active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50')}>
          All
        </button>
        {subjects.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-28 rounded-full" />)}
        {subjects.data?.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(active === s.id ? null : s.id)}
            className={cn('flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ring-1 transition', active === s.id ? 'text-white' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50')}
            style={active === s.id ? { backgroundColor: s.color, borderColor: s.color } : undefined}
          >
            <span aria-hidden>{s.icon}</span>
            {s.name}
            <span className={cn('rounded-full px-1.5 text-xs', active === s.id ? 'bg-white/20' : 'bg-slate-100 text-slate-600')}>{s.courseCount}</span>
          </button>
        ))}
      </div>

      {courses.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      )}
      {courses.isError && <ErrorState error={courses.error} onRetry={() => courses.refetch()} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <Link key={c.id} to={`/courses/${c.id}`} className="group">
            <Card className="h-full overflow-hidden transition group-hover:border-brand-300 group-hover:shadow-md">
              <div className="h-2" style={{ backgroundColor: c.color }} />
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {c.subjectName} · Grade {c.grade}
                  </span>
                  <Badge>{c.level}</Badge>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900 group-hover:text-brand-800">{c.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{c.description}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {c.lessonCount} {t('lessons').toLowerCase()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {c.estimatedHours} h
                  </span>
                </div>
                <ProgressBar value={c.percent ?? 0} className="mt-3" size="sm" />
                <p className="mt-1 text-xs text-slate-500">
                  {c.completedLessons ?? 0}/{c.lessonCount ?? 0} {t('completed').toLowerCase()}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
