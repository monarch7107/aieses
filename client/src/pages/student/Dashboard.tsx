import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Award, BookOpen, Flame, Sparkles, Target, TrendingUp } from 'lucide-react';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { scoreTone, timeAgo } from '@/lib/utils';
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorState, LinkButton, MasteryBar, ProgressBar, Skeleton, StatCard } from '@/components/ui';
import { ActivityChart } from '@/components/charts';
import type { Assignment, ProgressSummary, Recommendation } from '@shared/types';

export function useProgress() {
  return useQuery({ queryKey: ['progress', 'me'], queryFn: () => get<{ progress: ProgressSummary }>('/progress/me').then((r) => r.progress) });
}
export function useRecommendations() {
  return useQuery({ queryKey: ['recommendations'], queryFn: () => get<{ recommendations: Recommendation[] }>('/recommendations/me').then((r) => r.recommendations) });
}

const recTone: Record<Recommendation['type'], 'brand' | 'warning' | 'info' | 'purple'> = { lesson: 'brand', practice: 'warning', resource: 'info', diksha: 'purple' };

export function RecommendationCard({ rec, compact }: { rec: Recommendation; compact?: boolean }) {
  return (
    <Link to={rec.href} className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-brand-300 hover:bg-brand-50/40">
      <span className="mt-0.5 rounded-md bg-brand-50 p-1.5 text-brand-700">
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 group-hover:text-brand-800">{rec.title}</span>
          <Badge tone={recTone[rec.type]}>{rec.type}</Badge>
          {rec.priority <= 1 && <Badge tone="danger">Top priority</Badge>}
        </span>
        {!compact && <span className="mt-0.5 block text-xs text-slate-600">{rec.reason}</span>}
      </span>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 group-hover:text-brand-700" />
    </Link>
  );
}

export function StudentDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const progress = useProgress();
  const recs = useRecommendations();
  const assignments = useQuery({ queryKey: ['assignments', 'me'], queryFn: () => get<{ assignments: Assignment[] }>('/assignments').then((r) => r.assignments) });

  if (progress.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => progress.refetch()} />;
  const p = progress.data!;
  const pendingAssignments = (assignments.data ?? []).filter((a) => !a.mySubmission);
  const topRec = recs.data?.[0];
  const lessonPct = p.lessonsTotal ? Math.round((p.lessonsCompleted / p.lessonsTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">{t('welcome')},</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{user?.name.split(' ')[0]} 👋</h1>
        </div>
        <p className="text-sm text-slate-500">
          Grade {(user?.profile as { grade?: number } | null)?.grade ?? '—'} · {(user?.profile as { school?: string } | null)?.school ?? ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('lessonsCompleted')} value={`${p.lessonsCompleted}/${p.lessonsTotal}`} hint={`${lessonPct}% of enrolled content`} icon={<BookOpen className="h-5 w-5" />} />
        <StatCard label={t('averageScore')} value={p.averageScore === null ? '—' : `${Math.round(p.averageScore)}%`} hint={`${p.attemptsCount} attempts`} icon={<Target className="h-5 w-5" />} tone="info" />
        <StatCard label={t('points')} value={p.points} hint="Earned from lessons & practice" icon={<Award className="h-5 w-5" />} tone="warning" />
        <StatCard label={t('streak')} value={p.streakDays} hint={`${p.weeklyMinutes} min this week`} icon={<Flame className="h-5 w-5" />} tone="danger" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Continue learning + adaptive next step */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="flex flex-col p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('continueLearning')}</p>
              {p.lastLesson ? (
                <>
                  <p className="mt-2 text-xs text-slate-500">{p.lastLesson.courseTitle}</p>
                  <h3 className="text-lg font-semibold text-slate-900">{p.lastLesson.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.lastLesson.summary}</p>
                  <div className="mt-auto pt-4">
                    <LinkButton to={`/lessons/${p.lastLesson.id}`} icon={<ArrowRight className="h-4 w-4" />}>
                      {p.lastLesson.status === 'completed' ? 'Review lesson' : 'Resume lesson'}
                    </LinkButton>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-slate-600">You have not started a lesson yet. Pick a subject to begin.</p>
                  <div className="mt-auto pt-4">
                    <LinkButton to="/subjects">Browse subjects</LinkButton>
                  </div>
                </>
              )}
            </Card>
            <Card className="flex flex-col border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('yourNextStep')}</p>
                <Badge tone="brand">Adaptive Recommendation MVP</Badge>
              </div>
              {recs.isLoading ? (
                <Skeleton className="mt-3 h-16" />
              ) : topRec ? (
                <>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{topRec.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{topRec.reason}</p>
                  {topRec.skillName && (
                    <p className="mt-2 text-xs text-slate-500">
                      Targets skill: <span className="font-medium text-slate-700">{topRec.skillName}</span>
                    </p>
                  )}
                  <div className="mt-auto flex items-center gap-3 pt-4">
                    <LinkButton to={topRec.href} icon={<Sparkles className="h-4 w-4" />}>
                      Open
                    </LinkButton>
                    <Link to="/recommendations" className="text-sm font-medium text-brand-700 hover:underline">
                      {t('viewAll')} ({recs.data?.length ?? 0})
                    </Link>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-600">Complete a practice set and the adaptive engine will suggest what to do next.</p>
              )}
            </Card>
          </div>

          {/* Courses */}
          <Card>
            <CardHeader title={t('courses')} subtitle="Your enrolled courses and completion" action={<Link to="/subjects" className="text-sm font-medium text-brand-700 hover:underline">{t('viewAll')}</Link>} />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              {p.courses.map((c) => (
                <Link key={c.id} to={`/courses/${c.id}`} className="rounded-lg border border-slate-200 p-4 transition hover:border-brand-300 hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">{c.subjectName}</span>
                    <Badge>{c.level}</Badge>
                  </div>
                  <p className="mt-1 font-semibold text-slate-900">{c.title}</p>
                  <ProgressBar value={c.percent ?? 0} className="mt-3" label={`${c.completedLessons ?? 0}/${c.lessonCount ?? 0} ${t('lessons').toLowerCase()}`} />
                </Link>
              ))}
              {p.courses.length === 0 && <EmptyState title={t('noData')} className="sm:col-span-2" />}
            </CardBody>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader title={t('recentActivity')} subtitle="Last 14 days" />
            <CardBody>
              <ActivityChart data={p.activity} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t('weakAreas')} subtitle="Mastery below 60% — the adaptive engine focuses here" action={<TrendingUp className="h-4 w-4 text-slate-400" />} />
            <CardBody className="space-y-3">
              {p.weakSkills.length === 0 && <p className="text-sm text-slate-500">No weak areas detected yet. Keep practising!</p>}
              {p.weakSkills.slice(0, 5).map((s) => (
                <MasteryBar key={s.id} name={s.name} mastery={s.mastery} attempts={s.attemptsCount} />
              ))}
              <Link to="/progress" className="block pt-1 text-sm font-medium text-brand-700 hover:underline">
                Full skill report →
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('assignments')} subtitle={pendingAssignments.length ? `${pendingAssignments.length} pending` : 'All caught up'} action={<Link to="/assignments" className="text-sm font-medium text-brand-700 hover:underline">{t('viewAll')}</Link>} />
            <CardBody className="space-y-2">
              {pendingAssignments.slice(0, 3).map((a) => (
                <Link key={a.id} to="/assignments" className="block rounded-lg border border-slate-200 p-3 hover:border-brand-300">
                  <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                  <p className="text-xs text-slate-500">
                    {a.className} · {a.dueAt ? `due ${new Date(a.dueAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'no due date'}
                  </p>
                </Link>
              ))}
              {pendingAssignments.length === 0 && <p className="text-sm text-slate-500">Nothing pending.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent attempts" />
            <CardBody className="space-y-2">
              {p.recentAttempts.slice(0, 5).map((a) => (
                <Link key={a.id} to={`/attempts/${a.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">{a.assessmentTitle}</span>
                    <span className="text-xs text-slate-500">{timeAgo(a.submittedAt)}</span>
                  </span>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${scoreTone(a.percent)}`}>{a.percent}%</span>
                </Link>
              ))}
              {p.recentAttempts.length === 0 && <p className="text-sm text-slate-500">No attempts yet.</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
