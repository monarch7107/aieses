import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, Users } from 'lucide-react';
import { get } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn, timeAgo } from '@/lib/utils';
import { Avatar, Badge, Card, CardBody, CardHeader, ErrorState, LinkButton, PageHeader, Spinner, StatCard, Tabs } from '@/components/ui';
import { ActivityChart, BarChart, MasteryCell } from '@/components/charts';
import { riskTone, type ClassAnalytics, type StudentRow } from './types';
import type { ClassRoom } from '@shared/types';

export function ClassesPage() {
  const { t } = useI18n();
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => get<{ classes: ClassRoom[] }>('/classes').then((r) => r.classes) });
  if (classes.isLoading) return <Spinner />;
  if (classes.isError) return <ErrorState error={classes.error} onRetry={() => classes.refetch()} />;
  return (
    <div>
      <PageHeader title={t('classes')} subtitle="Your classes. Students join with the class code." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {classes.data!.map((c) => (
          <Link key={c.id} to={`/teacher/classes/${c.id}`}>
            <Card className="p-5 transition hover:border-brand-300 hover:shadow-md">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-brand-50 p-2 text-brand-700">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{c.name}</h3>
                  <p className="text-xs text-slate-500">
                    Grade {c.grade} · {c.studentCount ?? 0} students · code {c.joinCode}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

type SortKey = 'name' | 'averageScore' | 'lessonsCompleted' | 'lastActiveAt' | 'risk';

export function ClassPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const [tab, setTab] = useState<'students' | 'skills' | 'assignments'>('students');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'risk', dir: 1 });
  const analytics = useQuery({ queryKey: ['class-analytics', id], queryFn: () => get<{ analytics: ClassAnalytics }>(`/classes/${id}/analytics`).then((r) => r.analytics), enabled: !!id });
  if (analytics.isLoading) return <Spinner />;
  if (analytics.isError) return <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />;
  const a = analytics.data!;
  const riskOrder = { inactive: 0, needs_support: 1, on_track: 2 };
  const students = [...a.students].sort((x, y) => {
    const k = sort.key;
    let vx: number | string = 0;
    let vy: number | string = 0;
    if (k === 'risk') {
      vx = riskOrder[x.risk];
      vy = riskOrder[y.risk];
    } else if (k === 'name') {
      vx = x.name;
      vy = y.name;
    } else if (k === 'lastActiveAt') {
      vx = x.lastActiveAt ?? '';
      vy = y.lastActiveAt ?? '';
    } else {
      vx = x[k] ?? -1;
      vy = y[k] ?? -1;
    }
    return (vx < vy ? -1 : vx > vy ? 1 : 0) * sort.dir;
  });
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }));

  const Th = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <th className={cn('px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500', className)}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label} <ArrowUpDown className={cn('h-3 w-3', sort.key === k ? 'text-brand-600' : 'text-slate-300')} />
      </button>
    </th>
  );

  return (
    <div>
      <PageHeader
        crumbs={[{ to: '/teacher/classes', label: t('classes') }, { label: a.classroom.name }]}
        title={a.classroom.name}
        subtitle={`Grade ${a.classroom.grade} · join code ${a.classroom.joinCode}`}
        actions={<LinkButton to={`/teacher/assignments?new=1&classId=${a.classroom.id}`}>Create assignment</LinkButton>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label={t('students')} value={a.summary.studentCount} />
        <StatCard label="Class average" value={a.summary.averageScore === null ? '—' : `${Math.round(a.summary.averageScore)}%`} tone="info" />
        <StatCard label="Avg lessons done" value={a.summary.averageLessonsCompleted} />
        <StatCard label="Active (7d)" value={a.summary.activeLast7Days} tone="success" />
        <StatCard label="At risk" value={a.summary.atRisk} tone="danger" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Class weak areas" subtitle="Average mastery per skill across students who attempted it — the adaptive engine flags < 60%" />
          <CardBody>
            {a.weakAreas.length === 0 ? (
              <p className="text-sm text-slate-500">No class-wide weak areas.</p>
            ) : (
              <BarChart data={a.weakAreas.slice(0, 8).map((w) => ({ label: w.skillName, value: Math.round(w.averageMastery), color: '#e11d48' }))} valueSuffix="%" />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Score distribution" subtitle="All attempts by students in this class" />
          <CardBody>
            <BarChart data={a.scoreDistribution.map((b) => ({ label: b.bucket, value: b.count }))} />
          </CardBody>
        </Card>
      </div>

      <Tabs className="mt-6 w-fit" value={tab} onChange={setTab} tabs={[{ id: 'students', label: t('students'), count: a.students.length }, { id: 'skills', label: 'Skill heatmap' }, { id: 'assignments', label: t('assignments'), count: a.assignments.length }]} />

      {tab === 'students' && (
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <Th k="name" label="Student" />
                <Th k="risk" label="Status" />
                <Th k="averageScore" label="Avg score" />
                <Th k="lessonsCompleted" label="Lessons" />
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Weak areas</th>
                <Th k="lastActiveAt" label="Last active" />
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s: StudentRow) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link to={`/teacher/students/${s.id}`} className="flex items-center gap-2 font-medium text-slate-900 hover:text-brand-800">
                      <Avatar name={s.name} color={s.avatarColor} size="sm" /> {s.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={riskTone[s.risk].tone}>{riskTone[s.risk].label}</Badge>
                  </td>
                  <td className="px-3 py-2 font-semibold">{s.averageScore === null ? '—' : `${Math.round(s.averageScore)}%`}</td>
                  <td className="px-3 py-2">{s.lessonsCompleted}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {s.weakSkills.slice(0, 3).map((w) => (
                        <Badge key={w.id} tone="danger">
                          {w.name} {Math.round(w.mastery)}%
                        </Badge>
                      ))}
                      {s.weakSkills.length === 0 && <span className="text-xs text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{timeAgo(s.lastActiveAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`/teacher/students/${s.id}`} className="text-xs font-medium text-brand-700 hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'skills' && (
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Skill</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Avg mastery</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Weak students</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Assessed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {a.skillHeatmap.map((s) => (
                <tr key={s.skillId}>
                  <td className="px-3 py-2 font-medium text-slate-800">{s.skillName}</td>
                  <td className="px-3 py-2">
                    <MasteryCell value={s.averageMastery} />
                  </td>
                  <td className="px-3 py-2">{s.weakCount}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {s.assessed}/{a.summary.studentCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'assignments' && (
        <Card className="mt-3">
          <ul className="divide-y divide-slate-100">
            {a.assignments.map((as) => (
              <li key={as.id}>
                <Link to={`/teacher/assignments/${as.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{as.title}</span>
                    <span className="text-xs text-slate-500">
                      {as.type} · {as.dueAt ? `due ${new Date(as.dueAt).toLocaleDateString('en-IN')}` : 'no due date'}
                    </span>
                  </span>
                  <Badge>
                    {as.submissions}/{a.summary.studentCount} submitted
                  </Badge>
                </Link>
              </li>
            ))}
            {a.assignments.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">{t('noData')}</li>}
          </ul>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader title="Class activity (14 days)" />
        <CardBody>
          <ActivityChart data={a.activity} />
        </CardBody>
      </Card>
    </div>
  );
}
