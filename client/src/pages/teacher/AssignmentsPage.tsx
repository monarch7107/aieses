import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, FileText, Code2, Plus } from 'lucide-react';
import { get, patch, post } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { dueLabel, formatDate, timeAgo } from '@/lib/utils';
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Spinner, Textarea, useToast } from '@/components/ui';
import type { Assessment, Assignment, ClassRoom, Course, Skill, Submission } from '@shared/types';

type Mode = 'existing' | 'generate' | 'project';

function CreateAssignmentModal({ open, onClose, defaultClassId }: { open: boolean; onClose: () => void; defaultClassId?: string | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('existing');
  const [classId, setClassId] = useState(defaultClassId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [courseId, setCourseId] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [perSkill, setPerSkill] = useState(2);

  const classes = useQuery({ queryKey: ['classes'], queryFn: () => get<{ classes: ClassRoom[] }>('/classes').then((r) => r.classes), enabled: open });
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => get<{ courses: Course[] }>('/courses').then((r) => r.courses), enabled: open });
  const course = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => get<{ course: Course & { skills: Skill[]; quizzes: { id: string; title: string; questionCount: number }[]; modules: { lessons?: { id: string; title: string }[] }[] } }>(`/courses/${courseId}`).then((r) => r.course),
    enabled: open && !!courseId,
  });
  useEffect(() => {
    if (defaultClassId) setClassId(defaultClassId);
  }, [defaultClassId]);
  useEffect(() => {
    if (!classId && classes.data?.length) setClassId(classes.data[0].id);
  }, [classes.data, classId]);

  const create = useMutation({
    mutationFn: async () => {
      let finalAssessmentId: string | null = assessmentId || null;
      if (mode === 'generate') {
        const res = await post<{ assessment: Assessment }>('/assessments', { title: title || 'Custom assessment', description, skillIds, questionsPerSkill: perSkill, courseId: courseId || null });
        finalAssessmentId = res.assessment.id;
      }
      return post<{ assignment: Assignment }>('/assignments', {
        classId,
        title,
        description,
        type: mode === 'project' ? 'project' : 'assessment',
        assessmentId: mode === 'project' ? null : finalAssessmentId,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-assignments'] });
      qc.invalidateQueries({ queryKey: ['class-analytics'] });
      qc.invalidateQueries({ queryKey: ['teacher-overview'] });
      toast.show('Assignment created');
      onClose();
      setTitle('');
      setDescription('');
      setSkillIds([]);
      setAssessmentId('');
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : 'Failed', 'danger'),
  });

  const practiceSets = course.data?.modules.flatMap((m) => (m.lessons ?? []).map((l) => ({ id: `prac-${l.id}`, title: `Practice: ${l.title}` }))) ?? [];
  const valid = classId && title.trim().length >= 3 && (mode === 'project' || (mode === 'existing' ? !!assessmentId : skillIds.length > 0));

  return (
    <>
      {toast.node}
      <Modal
        open={open}
        onClose={onClose}
        title="Create assignment"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!valid}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ['existing', 'Assign existing quiz / practice', 'Auto-graded, uses seeded question bank'],
                ['generate', 'Generate assessment from skills', 'Pick skills; the question bank builds a quiz'],
                ['project', 'Project assignment', 'Students submit a workspace project'],
              ] as const
            ).map(([m, label, hint]) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-lg border p-3 text-left text-sm ${mode === m ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <span className="block font-semibold text-slate-900">{label}</span>
                <span className="text-xs text-slate-500">{hint}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input label="Due date" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fractions checkpoint" />
          <Textarea label="Instructions" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          {mode !== 'project' && (
            <Select label="Course" value={courseId} onChange={(e) => { setCourseId(e.target.value); setAssessmentId(''); setSkillIds([]); }}>
              <option value="">Select a course…</option>
              {courses.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          )}
          {mode === 'existing' && courseId && (
            <Select label="Assessment" value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>
              <option value="">Select…</option>
              <optgroup label="Course quizzes">
                {course.data?.quizzes.map((qz) => (
                  <option key={qz.id} value={qz.id}>
                    {qz.title} ({qz.questionCount} q)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Lesson practice sets">
                {practiceSets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </optgroup>
            </Select>
          )}
          {mode === 'generate' && courseId && (
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Skills to assess</p>
              <div className="flex flex-wrap gap-2">
                {course.data?.skills.map((s) => {
                  const on = skillIds.includes(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => setSkillIds(on ? skillIds.filter((x) => x !== s.id) : [...skillIds, s.id])} className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-700 ring-slate-300'}`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 w-40">
                <Select label="Questions per skill" value={perSkill} onChange={(e) => setPerSkill(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

export function TeacherAssignmentsPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const assignments = useQuery({ queryKey: ['teacher-assignments'], queryFn: () => get<{ assignments: Assignment[] }>('/assignments').then((r) => r.assignments) });
  const close = () => {
    setOpen(false);
    if (params.get('new')) setParams({});
  };
  if (assignments.isLoading) return <Spinner />;
  if (assignments.isError) return <ErrorState error={assignments.error} onRetry={() => assignments.refetch()} />;
  const list = assignments.data ?? [];
  return (
    <div>
      <PageHeader
        title={t('assignments')}
        subtitle="Assessments are auto-graded from the question bank; project submissions are graded here."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Create assignment
          </Button>
        }
      />
      {list.length === 0 && <EmptyState icon={<ClipboardList className="h-8 w-8" />} title="No assignments yet" action={<Button onClick={() => setOpen(true)}>Create assignment</Button>} />}
      <Card>
        <ul className="divide-y divide-slate-100">
          {list.map((a) => {
            const due = dueLabel(a.dueAt);
            return (
              <li key={a.id}>
                <Link to={`/teacher/assignments/${a.id}`} className="flex flex-col gap-2 px-5 py-3 hover:bg-slate-50 sm:flex-row sm:items-center">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{a.title}</span>
                      <Badge tone={a.type === 'assessment' ? 'info' : 'purple'}>{a.type}</Badge>
                    </span>
                    <span className="text-xs text-slate-500">
                      {a.className} · created {formatDate(a.createdAt)}
                    </span>
                  </span>
                  <Badge tone={due.tone === 'late' ? 'danger' : due.tone === 'warn' ? 'warning' : 'neutral'}>{due.text}</Badge>
                  <Badge>{a.submissionCount ?? 0} submissions</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
      <CreateAssignmentModal open={open} onClose={close} defaultClassId={params.get('classId')} />
    </div>
  );
}

interface AssignmentDetailResponse {
  assignment: Assignment;
  submissions: Submission[];
  roster: { id: string; name: string }[];
}
interface SubmissionDetail {
  submission: Submission;
  project: { id: string; title: string; description: string; status: string } | null;
  documents: { id: string; title: string; format: string; updated_at: string }[];
  files: { id: string; name: string; language: string; updated_at: string }[];
}

export function TeacherAssignmentDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [grading, setGrading] = useState<Submission | null>(null);
  const [grade, setGrade] = useState(80);
  const [feedback, setFeedback] = useState('');
  const data = useQuery({ queryKey: ['teacher-assignment', id], queryFn: () => get<AssignmentDetailResponse>(`/assignments/${id}`), enabled: !!id });
  const detail = useQuery({ queryKey: ['submission', grading?.id], queryFn: () => get<SubmissionDetail>(`/submissions/${grading!.id}`), enabled: !!grading });
  const gradeMutation = useMutation({
    mutationFn: () => patch(`/submissions/${grading!.id}/grade`, { grade, feedback }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-assignment', id] });
      qc.invalidateQueries({ queryKey: ['teacher-overview'] });
      toast.show('Grade saved');
      setGrading(null);
      setFeedback('');
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : 'Failed', 'danger'),
  });

  if (data.isLoading) return <Spinner />;
  if (data.isError) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  const { assignment: a, submissions, roster } = data.data!;
  const submittedIds = new Set(submissions.map((s) => s.studentId));
  const missing = roster.filter((r) => !submittedIds.has(r.id));
  const graded = submissions.filter((s) => s.grade !== null);
  const avg = graded.length ? Math.round(graded.reduce((sum, s) => sum + (s.grade ?? 0), 0) / graded.length) : null;

  return (
    <div>
      {toast.node}
      <PageHeader
        crumbs={[{ to: '/teacher/assignments', label: t('assignments') }, { label: a.title }]}
        title={a.title}
        subtitle={`${a.className} · ${a.type} · ${dueLabel(a.dueAt).text}`}
        actions={
          <>
            <Badge>{submissions.length}/{roster.length} submitted</Badge>
            {avg !== null && <Badge tone="info">avg {avg}%</Badge>}
          </>
        }
      />
      {a.description && <Alert tone="info" className="mb-4">{a.description}</Alert>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Submissions" subtitle={a.type === 'assessment' ? 'Auto-graded from the assessment attempt' : 'Open a submission to review the project and grade it'} />
          <ul className="divide-y divide-slate-100">
            {submissions.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{s.studentName}</span>
                  <span className="text-xs text-slate-500">
                    {timeAgo(s.submittedAt)} {s.content ? `· “${s.content.slice(0, 80)}${s.content.length > 80 ? '…' : ''}”` : ''}
                  </span>
                  {s.feedback && <span className="mt-0.5 block text-xs text-emerald-700">Feedback: {s.feedback}</span>}
                </span>
                {s.status === 'graded' ? <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> {s.grade}%</Badge> : <Badge tone="warning">to grade</Badge>}
                <Button size="sm" variant={s.status === 'graded' ? 'outline' : 'primary'} onClick={() => { setGrading(s); setGrade(s.grade ?? 80); setFeedback(s.feedback ?? ''); }}>
                  {s.status === 'graded' ? 'Review' : 'Grade'}
                </Button>
              </li>
            ))}
            {submissions.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">No submissions yet.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Not yet submitted" subtitle={`${missing.length} students`} />
          <ul className="divide-y divide-slate-100">
            {missing.map((m) => (
              <li key={m.id} className="px-5 py-2 text-sm">
                <Link to={`/teacher/students/${m.id}`} className="text-slate-800 hover:text-brand-800 hover:underline">
                  {m.name}
                </Link>
              </li>
            ))}
            {missing.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Everyone has submitted 🎉</li>}
          </ul>
        </Card>
      </div>

      <Modal
        open={!!grading}
        onClose={() => setGrading(null)}
        title={`Submission — ${grading?.studentName ?? ''}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setGrading(null)}>
              Close
            </Button>
            <Button onClick={() => gradeMutation.mutate()} loading={gradeMutation.isPending}>
              Save grade
            </Button>
          </>
        }
      >
        {detail.isLoading && <Spinner />}
        {detail.data && (
          <div className="space-y-4">
            {grading?.content && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase text-slate-500">Student note</p>
                <p className="mt-1 whitespace-pre-wrap">{grading.content}</p>
              </div>
            )}
            {detail.data.project ? (
              <Card>
                <CardHeader title={detail.data.project.title} subtitle={detail.data.project.description || 'Project'} />
                <CardBody className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">
                      <FileText className="h-3.5 w-3.5" /> Documents
                    </p>
                    <ul className="space-y-1 text-sm">
                      {detail.data.documents.map((d) => (
                        <li key={d.id}>
                          <a href={`/api/documents/${d.id}/export.pdf`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                            {d.title}
                          </a>{' '}
                          <span className="text-xs text-slate-400">({d.format}, PDF)</span>
                        </li>
                      ))}
                      {detail.data.documents.length === 0 && <li className="text-xs text-slate-400">none</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">
                      <Code2 className="h-3.5 w-3.5" /> Code files
                    </p>
                    <ul className="space-y-1 text-sm">
                      {detail.data.files.map((f) => (
                        <li key={f.id} className="font-mono text-xs">
                          {f.name} <span className="font-sans text-slate-400">({f.language})</span>
                        </li>
                      ))}
                      {detail.data.files.length === 0 && <li className="text-xs text-slate-400">none</li>}
                    </ul>
                  </div>
                </CardBody>
              </Card>
            ) : (
              <p className="text-sm text-slate-500">{grading?.attemptId ? 'Assessment attempt — auto-graded.' : 'No project attached.'}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
              <Input label="Grade (%)" type="number" min={0} max={100} value={grade} onChange={(e) => setGrade(Number(e.target.value))} />
              <Textarea label="Feedback" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What went well, what to improve…" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
