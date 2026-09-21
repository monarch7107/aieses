import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Badge, Card, CardBody, CardHeader, ErrorState, PageHeader, Select, Spinner, StatCard } from '@/components/ui';
import { ActivityChart, BarChart, MasteryCell } from '@/components/charts';
import { riskTone, type ClassAnalytics } from './types';
import type { ClassRoom } from '@shared/types';

export function TeacherAnalyticsPage() {
  const { t } = useI18n();
  const [classId, setClassId] = useState('');
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => get<{ classes: ClassRoom[] }>('/classes').then((r) => r.classes) });
  useEffect(() => {
    if (!classId && classes.data?.length) setClassId(classes.data[0].id);
  }, [classes.data, classId]);
  const analytics = useQuery({ queryKey: ['class-analytics', classId], queryFn: () => get<{ analytics: ClassAnalytics }>(`/classes/${classId}/analytics`).then((r) => r.analytics), enabled: !!classId });

  if (classes.isLoading) return <Spinner />;
  if (classes.isError) return <ErrorState error={classes.error} onRetry={() => classes.refetch()} />;
  const a = analytics.data;
  const riskCounts = a ? { on_track: a.students.filter((s) => s.risk === 'on_track').length, needs_support: a.students.filter((s) => s.risk === 'needs_support').length, inactive: a.students.filter((s) => s.risk === 'inactive').length } : null;

  return (
    <div>
      <PageHeader
        title={t('analytics')}
        subtitle="Class-level learning analytics: mastery heatmap, score distribution, engagement and risk segmentation."
        actions={
          <Select aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} className="w-64">
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        }
      />
      {analytics.isLoading && <Spinner />}
      {analytics.isError && <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />}
      {a && riskCounts && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Class average" value={a.summary.averageScore === null ? '—' : `${Math.round(a.summary.averageScore)}%`} hint={`${a.summary.totalAttempts} attempts`} tone="info" />
            <StatCard label="On track" value={riskCounts.on_track} tone="success" />
            <StatCard label="Needs support" value={riskCounts.needs_support} tone="warning" />
            <StatCard label="Inactive" value={riskCounts.inactive} tone="danger" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Score distribution" subtitle="All submitted attempts" />
              <CardBody>
                <BarChart data={a.scoreDistribution.map((b) => ({ label: b.bucket, value: b.count }))} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Weakest skills (class average)" subtitle="Lower is more urgent" />
              <CardBody>
                {a.weakAreas.length ? <BarChart data={a.weakAreas.slice(0, 8).map((w) => ({ label: w.skillName, value: Math.round(w.averageMastery), color: '#e11d48' }))} valueSuffix="%" /> : <p className="text-sm text-slate-500">No weak areas.</p>}
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader title="Mastery heatmap" subtitle="Students × skills. Only skills with at least one attempt are shown." />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Student</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                    {a.skillHeatmap
                      .filter((s) => s.assessed > 0)
                      .map((s) => (
                        <th key={s.skillId} className="px-2 py-2 text-left text-[11px] font-semibold text-slate-500">
                          {s.skillName}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {a.students.map((s) => (
                    <tr key={s.id}>
                      <td className="sticky left-0 bg-white px-3 py-1.5 font-medium text-slate-800">
                        <Link to={`/teacher/students/${s.id}`} className="hover:text-brand-800 hover:underline">
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge tone={riskTone[s.risk].tone}>{riskTone[s.risk].label}</Badge>
                      </td>
                      {a.skillHeatmap
                        .filter((k) => k.assessed > 0)
                        .map((k) => {
                          const w = s.weakSkills.find((x) => x.id === k.skillId);
                          return (
                            <td key={k.skillId} className="px-2 py-1.5">
                              {w ? <MasteryCell value={w.mastery} /> : <span className="text-xs text-slate-300">·</span>}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardBody className="border-t border-slate-100 text-xs text-slate-500">Cells show mastery only where a student is currently weak (&lt; 60%); a dot means the student is not weak on that skill (or has not attempted it). Averages per skill are on the class page.</CardBody>
          </Card>
          <Card>
            <CardHeader title="Engagement (14 days)" />
            <CardBody>
              <ActivityChart data={a.activity} />
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
