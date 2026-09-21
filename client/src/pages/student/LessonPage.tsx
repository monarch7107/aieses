import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ExternalLink, Languages, ListChecks, Volume2 } from 'lucide-react';
import { get, post } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Markdown } from '@/lib/markdown';
import { speech } from '@/lib/speech';
import { Alert, Badge, Button, Card, CardBody, CardHeader, ErrorState, LinkButton, PageHeader, Spinner, StatusBadge, useToast } from '@/components/ui';
import { TutorPanel } from '@/components/tutor/TutorPanel';
import type { Lesson, Recommendation } from '@shared/types';

export function LessonPage() {
  const { id } = useParams();
  const { t, language } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [speaking, setSpeaking] = useState(false);
  const lesson = useQuery({ queryKey: ['lesson', id, language], queryFn: () => get<{ lesson: Lesson }>(`/lessons/${id}?lang=${language}`).then((r) => r.lesson), enabled: !!id });

  const complete = useMutation({
    mutationFn: () => post<{ progress: { status: string; completedNow: boolean; pointsAwarded: number }; recommendations: Recommendation[] }>(`/lessons/${id}/progress`, { status: 'completed' }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['lesson', id] });
      qc.invalidateQueries({ queryKey: ['progress'] });
      qc.invalidateQueries({ queryKey: ['course'] });
      qc.invalidateQueries({ queryKey: ['recommendations'] });
      toast.show(res.progress.completedNow ? `Lesson completed! +${res.progress.pointsAwarded} points` : 'Already completed');
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : 'Failed', 'danger'),
  });

  if (lesson.isLoading) return <Spinner />;
  if (lesson.isError) return <ErrorState error={lesson.error} onRetry={() => lesson.refetch()} />;
  const l = lesson.data!;
  const tr = l.translation;
  const showTranslated = tr && tr.status === 'available' && language !== 'en';
  const title = showTranslated ? tr.title : l.title;
  const summary = showTranslated ? tr.summary : l.summary;
  const content = showTranslated ? tr.contentMd : l.contentMd;
  const keyPoints = showTranslated ? tr.keyPoints : l.keyPoints;

  const toggleSpeech = async () => {
    if (speaking) {
      speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    try {
      await speech.speak(`${title}. ${summary}. ${keyPoints.join('. ')}`, showTranslated ? language : 'en');
    } catch {
      toast.show('Speech is not available in this browser', 'info');
    } finally {
      setSpeaking(false);
    }
  };

  return (
    <div>
      {toast.node}
      <PageHeader
        crumbs={[{ to: '/subjects', label: t('subjects') }, { to: `/courses/${l.courseId}`, label: l.courseTitle }, { label: title }]}
        title={title}
        subtitle={summary}
        actions={
          <>
            <StatusBadge status={l.status ?? 'not_started'} />
            <Button variant="outline" size="sm" icon={<Volume2 className="h-4 w-4" />} onClick={toggleSpeech}>
              {speaking ? t('stop') : t('listen')}
            </Button>
            {l.status !== 'completed' && (
              <Button size="sm" variant="success" icon={<CheckCircle2 className="h-4 w-4" />} loading={complete.isPending} onClick={() => complete.mutate()}>
                {t('markComplete')}
              </Button>
            )}
          </>
        }
      />

      {language !== 'en' && (
        <div className="mb-4">
          {showTranslated ? (
            <Alert tone="success">
              <span className="flex items-center gap-2">
                <Languages className="h-4 w-4" /> {t('translationAvailable')} · {tr?.language.toUpperCase()} — human-authored demo translation
              </span>
            </Alert>
          ) : (
            <Alert tone="warning">
              <span className="flex items-center gap-2">
                <Languages className="h-4 w-4" /> {t('translationFallback')}
              </span>
            </Alert>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardBody className="py-6">
              <Markdown content={content} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('keyPoints')} />
            <CardBody>
              <ul className="space-y-2">
                {keyPoints.map((k, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{k}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {l.prevLessonId && (
                <LinkButton to={`/lessons/${l.prevLessonId}`} variant="outline" icon={<ArrowLeft className="h-4 w-4" />}>
                  {t('previous')}
                </LinkButton>
              )}
            </div>
            <div className="flex gap-2">
              {l.practiceAssessmentId && (
                <LinkButton to={`/assessments/${l.practiceAssessmentId}`} variant="primary" icon={<ListChecks className="h-4 w-4" />}>
                  {t('takePractice')}
                </LinkButton>
              )}
              {l.nextLessonId && (
                <Button variant="outline" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate(`/lessons/${l.nextLessonId}`)}>
                  {t('next')}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <TutorPanel context={{ lessonId: l.id, courseId: l.courseId, subjectId: l.subjectId }} compact title={t('aiTutor')} />

          <Card>
            <CardHeader title={t('skills')} />
            <CardBody className="flex flex-wrap gap-2">
              {l.skills.map((s) => (
                <Badge key={s.id} title={s.description}>
                  {s.name}
                </Badge>
              ))}
            </CardBody>
          </Card>

          {l.resources && l.resources.length > 0 && (
            <Card>
              <CardHeader title={t('resources')} subtitle="Related learning resources" />
              <ul className="divide-y divide-slate-100">
                {l.resources.map((r) => (
                  <li key={r.id} className="px-5 py-3">
                    <Link to={`/resources?highlight=${r.id}`} className="flex items-start gap-3 hover:text-brand-800">
                      <BookOpen className="mt-0.5 h-4 w-4 text-slate-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900">{r.title}</span>
                        <span className="text-xs text-slate-500">
                          {r.type} · {r.source}
                          {r.isDemo && ' · DEMO DATA'}
                        </span>
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
