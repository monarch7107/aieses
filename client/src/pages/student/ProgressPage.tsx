import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, Flame, Target } from 'lucide-react';
import { get } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn, masteryTone, scoreTone, timeAgo } from '@/lib/utils';
import { Badge, Card, CardBody, CardHeader, ErrorState, MasteryBar, PageHeader, ProgressBar, Spinner, StatCard } from '@/components/ui';
import { ActivityChart } from '@/components/charts';
import { useProgress } from './Dashboard';
import type { StudentSkill } from '@shared/types';

export function ProgressPage() {
  const { t } = useI18n();
  const progress = useProgress();
  const skills = useQuery({ queryKey: ['skills', 'me'], queryFn: () => get<{ skills: StudentSkill[] }>('/skills/me').then((r) => r.skills) });
  if (progress.isLoading || skills.isLoading) return <Spinner />;
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => progress.refetch()} />;
  if (skills.isError) return <ErrorState error={skills.error} onRetry={() => skills.refetch()} />;
  const p = progress.data!;
  const all = skills.data ?? [];
  const bySubject = all.reduce<Record<string, StudentSkill[]>>((acc, s) => {
    (acc[s.subjectId] ??= []).push(s);
    return acc;
  }, {});
  const subjectName = (id: string) => p.courses.find((c) => c.subjectId === id)?.subjectName ?? id;

  return (
    <div>
      <PageHeader title={t('progress')} subtitle="Mastery per skill, course completion and recent activity. Mastery below 60% is flagged as a weak area." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('lessonsCompleted')} value={`${p.lessonsCompleted}/${p.lessonsTotal}`} icon={<BookOpen className="h-5 w-5" />} />
        <StatCard label={t('averageScore')} value={p.averageScore === null ? '—' : `${Math.round(p.averageScore)}%`} hint={`${p.attemptsCount} attempts`} icon={<Target className="h-5 w-5" />} tone="info" />
        <StatCard label={t('points')} value={p.points} icon={<Award className="h-5 w-5" />} tone="warning" />
        <StatCard label={t('streak')} value={p.streakDays} icon={<Flame className="h-5 w-5" />} tone="danger" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {Object.entries(bySubject).map(([sid, list]) => (
            <Card key={sid}>
              <CardHeader title={`${subjectName(sid)} — ${t('skills').toLowerCase()}`} subtitle={`${list.filter((s) => s.level === 'weak').length} weak · ${list.filter((s) => s.level === 'strong').length} strong · ${list.filter((s) => s.level === 'new').length} not yet assessed`} />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                {list.map((s) =>
                  s.level === 'new' ? (
                    <div key={s.id} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">{s.name}</span>
                        <Badge>Not assessed</Badge>
                      </div>
                      <ProgressBar value={0} size="sm" className="mt-1" />
                    </div>
                  ) : (
                    <MasteryBar key={s.id} name={s.name} mastery={s.mastery} attempts={s.attemptsCount} />
                  ),
                )}
              </CardBody>
            </Card>
          ))}
          <Card>
            <CardHeader title={t('recentActivity')} subtitle="Lessons viewed and practice attempts, last 14 days" />
            <CardBody>
              <ActivityChart data={p.activity} />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title={t('courses')} />
            <CardBody className="space-y-3">
              {p.courses.map((c) => (
                <Link key={c.id} to={`/courses/${c.id}`} className="block">
                  <ProgressBar value={c.percent ?? 0} label={c.title} />
                </Link>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Attempt history" />
            <ul className="divide-y divide-slate-100">
              {p.recentAttempts.map((a) => (
                <li key={a.id}>
                  <Link to={`/attempts/${a.id}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{a.assessmentTitle}</span>
                      <span className="text-xs text-slate-500">{timeAgo(a.submittedAt)}</span>
                    </span>
                    <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold ring-1', scoreTone(a.percent))}>{a.percent}%</span>
                  </Link>
                </li>
              ))}
              {p.recentAttempts.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">{t('noData')}</li>}
            </ul>
          </Card>
          <Card className="p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-700">How mastery is computed (Adaptive Recommendation MVP)</p>
            <p className="mt-1">Each answered question updates the skill’s mastery with an exponential moving average (α = 0.35). Skills under 60% are weak, 60–79% developing, 80%+ strong. Recommendations target weak skills with a review lesson, a practice set and a resource.</p>
            <p className="mt-1 flex gap-2">
              {(['weak', 'developing', 'strong'] as const).map((lvl) => {
                const tone = masteryTone(lvl === 'weak' ? 30 : lvl === 'developing' ? 70 : 90);
                return (
                  <span key={lvl} className={cn('rounded px-1.5 py-0.5', tone.bg, tone.text)}>
                    {tone.label}
                  </span>
                );
              })}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
