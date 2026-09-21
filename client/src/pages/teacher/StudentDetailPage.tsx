import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn, scoreTone, timeAgo } from '@/lib/utils';
import { Avatar, Badge, Card, CardBody, CardHeader, ErrorState, MasteryBar, PageHeader, Spinner, StatCard, StatusBadge } from '@/components/ui';
import { ActivityChart } from '@/components/charts';
import { riskTone, type StudentDetail } from './types';

export function StudentDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const detail = useQuery({ queryKey: ['student-detail', id], queryFn: () => get<{ detail: StudentDetail }>(`/students/${id}/detail`).then((r) => r.detail), enabled: !!id });
  if (detail.isLoading) return <Spinner />;
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;
  const d = detail.data!;
  const s = d.student;
  const weak = d.skills.filter((k) => k.level === 'weak');
  const strong = d.skills.filter((k) => k.level === 'strong');

  return (
    <div>
      <PageHeader
        crumbs={[{ to: '/teacher/classes', label: t('classes') }, { label: s.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={s.name} color={s.avatarColor} size="lg" /> {s.name}
          </span>
        }
        subtitle={`${s.email} · Grade ${s.grade}`}
        actions={<Badge tone={riskTone[s.risk].tone}>{riskTone[s.risk].label}</Badge>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label={t('averageScore')} value={s.averageScore === null ? '—' : `${Math.round(s.averageScore)}%`} tone="info" />
        <StatCard label={t('lessonsCompleted')} value={s.lessonsCompleted} />
        <StatCard label="Attempts" value={s.attempts} />
        <StatCard label={t('points')} value={s.points} tone="warning" />
        <StatCard label={t('streak')} value={d.streakDays} hint={`last active ${timeAgo(s.lastActiveAt)}`} tone="danger" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t('weakAreas')} subtitle="Skills below 60% mastery — suggested focus for intervention" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              {weak.map((k) => (
                <MasteryBar key={k.id} name={k.name} mastery={k.mastery} attempts={k.attemptsCount} />
              ))}
              {weak.length === 0 && <p className="text-sm text-slate-500">No weak areas detected.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t('strongAreas')} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              {strong.map((k) => (
                <MasteryBar key={k.id} name={k.name} mastery={k.mastery} attempts={k.attemptsCount} />
              ))}
              {strong.length === 0 && <p className="text-sm text-slate-500">No strong areas yet.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Attempt history" />
            <ul className="divide-y divide-slate-100">
              {d.attempts.map((a) => (
                <li key={a.id}>
                  <Link to={`/teacher/attempts/${a.id}`} onClick={(e) => e.preventDefault()} className="flex items-center justify-between px-5 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{a.assessmentTitle}</span>
                      <span className="text-xs text-slate-500">{timeAgo(a.submittedAt)}</span>
                    </span>
                    <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold ring-1', scoreTone(a.percent))}>
                      {a.percent}% ({a.score}/{a.maxScore})
                    </span>
                  </Link>
                </li>
              ))}
              {d.attempts.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">{t('noData')}</li>}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Activity (14 days)" />
            <CardBody>
              <ActivityChart data={d.activity} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Lesson progress" />
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {d.progress.map((p) => (
                <li key={p.lessonId} className="flex items-center justify-between px-5 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-slate-800">{p.lessonTitle}</span>
                    <span className="text-xs text-slate-500">{p.courseTitle}</span>
                  </span>
                  <StatusBadge status={p.status} />
                </li>
              ))}
              {d.progress.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">{t('noData')}</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Submissions" />
            <ul className="divide-y divide-slate-100">
              {d.submissions.map((sub) => (
                <li key={sub.id}>
                  <Link to={`/teacher/assignments/${sub.assignmentId}`} className="flex items-center justify-between px-5 py-2 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-slate-800">{sub.title}</span>
                      <span className="text-xs text-slate-500">{timeAgo(sub.submittedAt)}</span>
                    </span>
                    <Badge tone={sub.status === 'graded' ? 'success' : 'warning'}>{sub.status === 'graded' ? `${sub.grade}%` : 'to grade'}</Badge>
                  </Link>
                </li>
              ))}
              {d.submissions.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">{t('noData')}</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
