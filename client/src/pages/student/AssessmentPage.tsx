import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Send } from 'lucide-react';
import { get, post } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Alert, Badge, Button, Card, CardBody, ErrorState, PageHeader, Spinner } from '@/components/ui';
import type { Assessment, Attempt, AttemptAnswer } from '@shared/types';

export function AssessmentPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [elapsed, setElapsed] = useState(0);
  const assessment = useQuery({ queryKey: ['assessment', id], queryFn: () => get<{ assessment: Assessment }>(`/assessments/${id}`).then((r) => r.assessment), enabled: !!id, staleTime: 0 });

  useEffect(() => {
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const submit = useMutation({
    mutationFn: (payload: AttemptAnswer[]) => post<{ attempt: Attempt }>(`/assessments/${id}/submit`, { answers: payload }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['progress'] });
      qc.invalidateQueries({ queryKey: ['recommendations'] });
      qc.invalidateQueries({ queryKey: ['skills'] });
      qc.invalidateQueries({ queryKey: ['assignments'] });
      navigate(`/attempts/${res.attempt.id}`, { replace: true });
    },
  });

  const questions = assessment.data?.questions ?? [];
  const answered = useMemo(() => questions.filter((qn) => answers[qn.id] !== undefined && answers[qn.id] !== '').length, [answers, questions]);

  if (assessment.isLoading) return <Spinner />;
  if (assessment.isError) return <ErrorState error={assessment.error} onRetry={() => assessment.refetch()} />;
  const a = assessment.data!;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const overLimit = a.timeLimitMin ? elapsed > a.timeLimitMin * 60 : false;

  const onSubmit = () => {
    const payload: AttemptAnswer[] = questions.map((qn) => ({ questionId: qn.id, answer: answers[qn.id] ?? null }));
    submit.mutate(payload);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        crumbs={[{ to: a.courseId ? `/courses/${a.courseId}` : '/subjects', label: t('backToCourse') }, { label: a.title }]}
        title={a.title}
        subtitle={a.description}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={a.type === 'practice' ? 'info' : 'brand'}>{a.type}</Badge>
            <Badge tone={overLimit ? 'danger' : 'neutral'}>
              <Clock className="h-3 w-3" /> {mm}:{ss}
              {a.timeLimitMin ? ` / ${a.timeLimitMin}:00` : ''}
            </Badge>
          </div>
        }
      />
      {a.adaptiveNote && (
        <Alert tone="info" className="mb-4" title={`Adaptive level: ${a.adaptiveLevel ?? 'foundation'}`}>
          {a.adaptiveNote} <span className="text-xs text-sky-700">(Adaptive Recommendation MVP)</span>
        </Alert>
      )}
      <div className="space-y-4">
        {questions.map((qn, qi) => (
          <Card key={qn.id}>
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-500">
                  Question {qi + 1} of {questions.length}
                </p>
                <Badge>{'●'.repeat(qn.difficulty)}{'○'.repeat(3 - qn.difficulty)} difficulty</Badge>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-base font-medium text-slate-900">{qn.prompt}</p>
              {qn.type === 'mcq' && qn.options ? (
                <div role="radiogroup" aria-label={`Answer for question ${qi + 1}`} className="mt-4 grid gap-2">
                  {qn.options.map((opt, oi) => {
                    const selected = answers[qn.id] === oi;
                    return (
                      <button
                        key={oi}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setAnswers((s) => ({ ...s, [qn.id]: oi }))}
                        className={cn('flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition', selected ? 'border-brand-500 bg-brand-50 text-brand-900 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-slate-300')}
                      >
                        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold', selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-500')}>{String.fromCharCode(65 + oi)}</span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  value={(answers[qn.id] as string) ?? ''}
                  onChange={(e) => setAnswers((s) => ({ ...s, [qn.id]: e.target.value }))}
                  placeholder="Type your answer"
                  className="mt-4 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              )}
            </CardBody>
          </Card>
        ))}
      </div>
      {submit.isError && (
        <Alert tone="danger" className="mt-4">
          {submit.error instanceof Error ? submit.error.message : 'Submission failed'}
        </Alert>
      )}
      <div className="sticky bottom-0 mt-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white/95 px-5 py-3 shadow-lg backdrop-blur">
        <p className="text-sm text-slate-600">
          {answered}/{questions.length} answered
        </p>
        <Button onClick={onSubmit} loading={submit.isPending} icon={<Send className="h-4 w-4" />} disabled={questions.length === 0}>
          {t('submit')}
        </Button>
      </div>
    </div>
  );
}
