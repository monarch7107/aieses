import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Award, CheckCircle2, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import { get } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn, masteryTone } from '@/lib/utils';
import { Badge, Card, CardBody, CardHeader, ErrorState, LinkButton, PageHeader, Spinner } from '@/components/ui';
import { Ring } from '@/components/charts';
import { RecommendationCard } from './Dashboard';
import type { Attempt } from '@shared/types';

export function AttemptResultPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const attempt = useQuery({ queryKey: ['attempt', id], queryFn: () => get<{ attempt: Attempt }>(`/attempts/${id}`).then((r) => r.attempt), enabled: !!id });
  if (attempt.isLoading) return <Spinner />;
  if (attempt.isError) return <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />;
  const a = attempt.data!;
  const weak = a.weakSkills ?? (a.skillBreakdown ?? []).filter((s) => s.weak);
  const recs = a.recommendations ?? [];
  const verdict = a.percent >= 80 ? 'Excellent work!' : a.percent >= 60 ? 'Good — keep going.' : 'Let’s strengthen the basics.';

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader crumbs={[{ to: '/', label: t('dashboard') }, { label: a.assessmentTitle ?? 'Result' }]} title={`${t('score')}: ${a.percent}%`} subtitle={`${a.assessmentTitle} · ${a.score}/${a.maxScore} points`} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4 p-5 md:col-span-1">
          <Ring value={a.percent} size={96} stroke={10} label="score" />
          <div>
            <p className="text-lg font-semibold text-slate-900">{verdict}</p>
            {a.pointsEarned !== undefined && (
              <p className="mt-1 flex items-center gap-1 text-sm text-amber-700">
                <Award className="h-4 w-4" /> +{a.pointsEarned} {t('points').toLowerCase()}
              </p>
            )}
          </div>
        </Card>
        <Card className="p-5 md:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Skill breakdown</p>
            <Badge tone="brand">Adaptive Recommendation MVP</Badge>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(a.skillBreakdown ?? []).map((s) => {
              const tone = masteryTone(s.mastery);
              return (
                <div key={s.skillId} className={cn('rounded-lg px-3 py-2', tone.bg)}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{s.skillName}</span>
                    <span className={cn('text-xs font-semibold', tone.text)}>{s.weak ? 'Weak area' : tone.label}</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {s.correct}/{s.total} correct here · {t('mastery').toLowerCase()} now {Math.round(s.mastery)}%
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {weak.length > 0 && (
        <Card className="mt-6 border-brand-200">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-600" /> {t('weakAreas')} → {t('recommendations')}
              </span>
            }
            subtitle={`Based on this attempt, the adaptive engine detected ${weak.map((w) => w.skillName).join(', ')} below the 60% mastery threshold and generated a personalised plan.`}
          />
          <CardBody className="grid gap-2 md:grid-cols-2">
            {recs.slice(0, 6).map((r) => (
              <RecommendationCard key={r.id} rec={r} />
            ))}
            {recs.length === 0 && <p className="text-sm text-slate-500">No recommendations generated.</p>}
          </CardBody>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader title="Question review" subtitle="Your answers with explanations" />
        <ul className="divide-y divide-slate-100">
          {(a.feedback ?? []).map((f, i) => (
            <li key={f.questionId} className="px-5 py-4">
              <div className="flex items-start gap-3">
                {f.correct ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {i + 1}. {f.prompt}
                  </p>
                  <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                    <p className={cn('rounded-md px-2 py-1', f.correct ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800')}>
                      <span className="text-xs font-semibold uppercase">{t('yourAnswer')}: </span>
                      {f.yourAnswer ?? '—'}
                    </p>
                    {!f.correct && (
                      <p className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-800">
                        <span className="text-xs font-semibold uppercase">{t('correctAnswer')}: </span>
                        {f.correctAnswer}
                      </p>
                    )}
                  </div>
                  {f.explanation && (
                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-medium text-slate-700">{t('explanation')}: </span>
                      {f.explanation}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    Skill: {f.skillName} · {f.earned}/{f.points} pts
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 flex flex-wrap gap-2">
        <LinkButton to={`/assessments/${a.assessmentId}`} variant="outline" icon={<RotateCcw className="h-4 w-4" />}>
          Try again
        </LinkButton>
        <LinkButton to="/recommendations" icon={<Sparkles className="h-4 w-4" />}>
          Open recommendations
        </LinkButton>
        <Link to="/progress" className="inline-flex h-10 items-center px-3 text-sm font-medium text-brand-700 hover:underline">
          View progress →
        </Link>
      </div>
    </div>
  );
}
