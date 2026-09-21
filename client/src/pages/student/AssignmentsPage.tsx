import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, FolderKanban, Send } from 'lucide-react';
import { get, post } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn, dueLabel, formatDate } from '@/lib/utils';
import { Badge, Button, Card, EmptyState, ErrorState, LinkButton, Modal, PageHeader, Select, Spinner, Textarea, useToast } from '@/components/ui';
import type { Assignment, Project } from '@shared/types';

export function AssignmentsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [submitting, setSubmitting] = useState<Assignment | null>(null);
  const [projectId, setProjectId] = useState('');
  const [note, setNote] = useState('');
  const assignments = useQuery({ queryKey: ['assignments'], queryFn: () => get<{ assignments: Assignment[] }>('/assignments').then((r) => r.assignments) });
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => get<{ projects: Project[] }>('/projects').then((r) => r.projects), enabled: !!submitting });
  const submit = useMutation({
    mutationFn: () => post('/submissions', { assignmentId: submitting!.id, projectId: projectId || null, content: note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setSubmitting(null);
      setNote('');
      setProjectId('');
      toast.show('Submitted to your teacher');
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : 'Failed', 'danger'),
  });

  if (assignments.isLoading) return <Spinner />;
  if (assignments.isError) return <ErrorState error={assignments.error} onRetry={() => assignments.refetch()} />;
  const list = assignments.data ?? [];
  const pending = list.filter((a) => !a.mySubmission);
  const done = list.filter((a) => a.mySubmission);

  const Row = ({ a }: { a: Assignment }) => {
    const due = dueLabel(a.dueAt);
    const sub = a.mySubmission;
    return (
      <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{a.title}</p>
            <Badge tone={a.type === 'assessment' ? 'info' : 'purple'}>{a.type}</Badge>
            {sub ? <Badge tone={sub.status === 'graded' ? 'success' : 'brand'}>{sub.status === 'graded' ? `Graded: ${sub.grade}%` : t('submitted')}</Badge> : <Badge tone={due.tone === 'late' ? 'danger' : due.tone === 'warn' ? 'warning' : 'neutral'}>{due.text}</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {a.className} · {a.description}
          </p>
          {sub?.feedback && (
            <p className="mt-1 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
              <span className="font-semibold">Teacher feedback:</span> {sub.feedback}
            </p>
          )}
          {sub && <p className="mt-1 text-[11px] text-slate-400">Submitted {formatDate(sub.submittedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {a.type === 'assessment' && a.assessmentId && (
            <LinkButton to={`/assessments/${a.assessmentId}`} size="sm" variant={sub ? 'outline' : 'primary'} icon={<ClipboardList className="h-4 w-4" />}>
              {sub ? 'Retake' : 'Start'}
            </LinkButton>
          )}
          {a.type === 'project' && (
            <Button size="sm" variant={sub ? 'outline' : 'primary'} icon={<Send className="h-4 w-4" />} onClick={() => setSubmitting(a)}>
              {sub ? 'Resubmit' : 'Submit project'}
            </Button>
          )}
          {sub?.attemptId && (
            <Link to={`/attempts/${sub.attemptId}`} className="inline-flex h-8 items-center px-2 text-xs font-medium text-brand-700 hover:underline">
              View result
            </Link>
          )}
        </div>
      </li>
    );
  };

  return (
    <div>
      {toast.node}
      <PageHeader title={t('assignments')} subtitle="Assignments from your classes. Assessment assignments are auto-graded; project assignments are submitted from your workspace." />
      {list.length === 0 && <EmptyState icon={<ClipboardList className="h-8 w-8" />} title="No assignments" description="Your teacher has not assigned anything yet." />}
      {pending.length > 0 && (
        <Card className="mb-6">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">
            {t('pending')} <span className="text-slate-400">({pending.length})</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {pending.map((a) => (
              <Row key={a.id} a={a} />
            ))}
          </ul>
        </Card>
      )}
      {done.length > 0 && (
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">
            {t('submitted')} <span className="text-slate-400">({done.length})</span>
          </div>
          <ul className={cn('divide-y divide-slate-100')}>
            {done.map((a) => (
              <Row key={a.id} a={a} />
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={!!submitting}
        onClose={() => setSubmitting(null)}
        title={`Submit: ${submitting?.title ?? ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setSubmitting(null)}>
              Cancel
            </Button>
            <Button onClick={() => submit.mutate()} loading={submit.isPending} icon={<Send className="h-4 w-4" />}>
              {t('submit')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select label="Attach a project from your workspace" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— No project (note only) —</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.type}, {p.status})
              </option>
            ))}
          </Select>
          <Textarea label="Note to teacher" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you build? Anything the teacher should know?" />
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <FolderKanban className="h-3.5 w-3.5" /> Need a project first?{' '}
            <Link to="/workspace" className="text-brand-700 hover:underline">
              Open workspace
            </Link>
          </p>
        </div>
      </Modal>
    </div>
  );
}
