import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ClipboardCheck, Users, School } from 'lucide-react';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { timeAgo } from '@/lib/utils';
import { Badge, Card, CardBody, CardHeader, ErrorState, LinkButton, Spinner, StatCard } from '@/components/ui';
import { ActivityChart } from '@/components/charts';
import type { TeacherOverview } from './types';

export function TeacherDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const overview = useQuery({ queryKey: ['teacher-overview'], queryFn: () => get<{ overview: TeacherOverview }>('/analytics/teacher/overview').then((r) => r.overview) });
  if (overview.isLoading) return <Spinner />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  const o = overview.data!;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{t('welcome')},</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{user?.name}</h1>
        <p className="mt-1 text-sm text-slate-600">{(user?.profile as { school?: string } | null)?.school}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('students')} value={o.totals.students} hint={`${o.totals.classes} ${t('classes').toLowerCase()}`} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Need attention" value={o.totals.atRisk} hint="needs support or inactive" icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
        <StatCard label="Pending grading" value={o.totals.pendingGrading} hint="project submissions" icon={<ClipboardCheck className="h-5 w-5" />} tone="warning" />
        <StatCard label={t('classes')} value={o.totals.classes} icon={<School className="h-5 w-5" />} tone="info" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t('classes')} subtitle="Class averages and the top weak areas detected by the adaptive engine" />
            <ul className="divide-y divide-slate-100">
              {o.classes.map((c) => (
                <li key={c.classroom.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <Link to={`/teacher/classes/${c.classroom.id}`} className="text-base font-semibold text-slate-900 hover:text-brand-800 hover:underline">
                      {c.classroom.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      Grade {c.classroom.grade} · {c.summary.studentCount} students · join code <code className="rounded bg-slate-100 px-1">{c.classroom.joinCode}</code>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.weakAreas.map((w) => (
                        <Badge key={w.skillId} tone="danger" title={`${w.weakCount} students weak`}>
                          {w.skillName} · {Math.round(w.averageMastery)}%
                        </Badge>
                      ))}
                      {c.weakAreas.length === 0 && <Badge tone="success">No class-wide weak areas</Badge>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center sm:text-right">
                    <div>
                      <p className="text-lg font-bold text-slate-900">{c.summary.averageScore === null ? '—' : `${Math.round(c.summary.averageScore)}%`}</p>
                      <p className="text-[11px] text-slate-500">avg score</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900">{c.summary.activeLast7Days}</p>
                      <p className="text-[11px] text-slate-500">active 7d</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-rose-600">{c.summary.atRisk}</p>
                      <p className="text-[11px] text-slate-500">at risk</p>
                    </div>
                  </div>
                  <LinkButton to={`/teacher/classes/${c.classroom.id}`} size="sm" variant="outline">
                    Open
                  </LinkButton>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Class activity" subtitle="Lessons viewed and attempts across all your students, last 14 days" />
            <CardBody>
              <ActivityChart data={o.activity} />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Recent submissions" action={<Link to="/teacher/assignments" className="text-sm font-medium text-brand-700 hover:underline">{t('viewAll')}</Link>} />
            <ul className="divide-y divide-slate-100">
              {o.recentSubmissions.map((s) => (
                <li key={s.id}>
                  <Link to={`/teacher/assignments/${s.assignmentId}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{s.studentName}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {s.title} · {timeAgo(s.submittedAt)}
                      </span>
                    </span>
                    <Badge tone={s.status === 'graded' ? 'success' : 'warning'}>{s.status}</Badge>
                  </Link>
                </li>
              ))}
              {o.recentSubmissions.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">{t('noData')}</li>}
            </ul>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">Quick actions</p>
            <div className="mt-3 flex flex-col gap-2">
              <LinkButton to="/teacher/assignments?new=1" variant="primary" size="sm">
                Create assignment / assessment
              </LinkButton>
              <LinkButton to="/teacher/analytics" variant="outline" size="sm">
                Open analytics
              </LinkButton>
              <LinkButton to="/teacher/library" variant="outline" size="sm">
                Browse course library
              </LinkButton>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
