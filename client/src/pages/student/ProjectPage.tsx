import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Code2, FileText, Plus, Send, Trash2 } from 'lucide-react';
import { del, get, post } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { timeAgo } from '@/lib/utils';
import { Alert, Badge, Button, Card, CardBody, CardHeader, ErrorState, Input, Modal, PageHeader, Select, Spinner, Textarea, useToast } from '@/components/ui';
import type { Assignment, CodeLanguage, Document, DocumentFormat, Project } from '@shared/types';

export function ProjectPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [docModal, setDocModal] = useState(false);
  const [fileModal, setFileModal] = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  const [docForm, setDocForm] = useState({ title: '', format: 'markdown' as DocumentFormat });
  const [fileForm, setFileForm] = useState({ name: 'main.py', language: 'python' as CodeLanguage });
  const [submitForm, setSubmitForm] = useState({ assignmentId: '', note: '' });

  const project = useQuery({ queryKey: ['project', id], queryFn: () => get<{ project: Project }>(`/projects/${id}`).then((r) => r.project), enabled: !!id });
  const assignments = useQuery({ queryKey: ['assignments'], queryFn: () => get<{ assignments: Assignment[] }>('/assignments').then((r) => r.assignments), enabled: submitModal });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['project', id] });
    qc.invalidateQueries({ queryKey: ['projects'] });
  };
  const createDoc = useMutation({
    mutationFn: () => post<{ document: Document }>('/documents', { projectId: id, title: docForm.title, format: docForm.format, content: docForm.format === 'markdown' ? `# ${docForm.title}\n\n` : '' }),
    onSuccess: (res) => {
      invalidate();
      setDocModal(false);
      navigate(`/documents/${res.document.id}`);
    },
  });
  const createFile = useMutation({
    mutationFn: () => post<{ file: { id: string } }>('/files', { projectId: id, name: fileForm.name, language: fileForm.language }),
    onSuccess: (res) => {
      invalidate();
      setFileModal(false);
      navigate(`/ide/${id}?file=${res.file.id}`);
    },
  });
  const submit = useMutation({
    mutationFn: () => post(`/projects/${id}/submit`, { assignmentId: submitForm.assignmentId || null, note: submitForm.note }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['progress'] });
      setSubmitModal(false);
      toast.show('Project submitted');
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : 'Failed', 'danger'),
  });
  const remove = useMutation({
    mutationFn: () => del(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      navigate('/workspace');
    },
  });

  if (project.isLoading) return <Spinner />;
  if (project.isError) return <ErrorState error={project.error} onRetry={() => project.refetch()} />;
  const p = project.data!;
  const languageForName = (name: string): CodeLanguage => (name.endsWith('.js') ? 'javascript' : name.endsWith('.c') ? 'c' : name.endsWith('.java') ? 'java' : 'python');

  return (
    <div>
      {toast.node}
      <PageHeader
        crumbs={[{ to: '/workspace', label: t('workspace') }, { label: p.title }]}
        title={p.title}
        subtitle={p.description || 'No description'}
        actions={
          <>
            <Badge tone={p.status === 'submitted' ? 'success' : 'warning'}>{p.status}</Badge>
            <Button variant="outline" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => confirm('Delete this project and all its documents and files?') && remove.mutate()}>
              Delete
            </Button>
            <Button size="sm" variant="success" icon={<Send className="h-4 w-4" />} onClick={() => setSubmitModal(true)}>
              {p.status === 'submitted' ? 'Resubmit project' : 'Submit project'}
            </Button>
          </>
        }
      />
      {p.status === 'submitted' && (
        <Alert tone="success" className="mb-4">
          This project has been submitted{p.assignmentId ? ' to an assignment' : ''}. You can keep editing and resubmit.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-600" /> Documents
              </span>
            }
            subtitle="Markdown, plain text or rich text · export to PDF"
            action={
              <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setDocModal(true)}>
                {t('newDocument')}
              </Button>
            }
          />
          <ul className="divide-y divide-slate-100">
            {(p.documents ?? []).map((d) => (
              <li key={d.id}>
                <Link to={`/documents/${d.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{d.title}</span>
                    <span className="text-xs text-slate-500">
                      {d.format} · updated {timeAgo(d.updatedAt)}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-brand-700">Open →</span>
                </Link>
              </li>
            ))}
            {(p.documents ?? []).length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">No documents yet.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-sky-600" /> Code files
              </span>
            }
            subtitle="Run JavaScript & Python in the browser sandbox; C/Java in the simulated demo runner"
            action={
              <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setFileModal(true)}>
                {t('newFile')}
              </Button>
            }
          />
          <ul className="divide-y divide-slate-100">
            {(p.files ?? []).map((f) => (
              <li key={f.id}>
                <Link to={`/ide/${p.id}?file=${f.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-sm font-medium text-slate-900">{f.name}</span>
                    <span className="text-xs text-slate-500">
                      {f.language} · {f.size} B · updated {timeAgo(f.updatedAt)}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-brand-700">Open in IDE →</span>
                </Link>
              </li>
            ))}
            {(p.files ?? []).length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">No code files yet.</li>}
          </ul>
          {(p.files ?? []).length > 0 && (
            <CardBody className="border-t border-slate-100">
              <Link to={`/ide/${p.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                Open project in the IDE →
              </Link>
            </CardBody>
          )}
        </Card>
      </div>

      <Modal
        open={docModal}
        onClose={() => setDocModal(false)}
        title={t('newDocument')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDocModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => createDoc.mutate()} loading={createDoc.isPending} disabled={!docForm.title.trim()}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Title" value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} autoFocus />
          <Select label="Format" value={docForm.format} onChange={(e) => setDocForm({ ...docForm, format: e.target.value as DocumentFormat })}>
            <option value="markdown">Markdown</option>
            <option value="richtext">Rich text</option>
            <option value="text">Plain text</option>
          </Select>
        </div>
      </Modal>

      <Modal
        open={fileModal}
        onClose={() => setFileModal(false)}
        title={t('newFile')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFileModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => createFile.mutate()} loading={createFile.isPending} disabled={!fileForm.name.trim()}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="File name" value={fileForm.name} onChange={(e) => setFileForm({ name: e.target.value, language: languageForName(e.target.value) })} />
          <Select label="Language" value={fileForm.language} onChange={(e) => setFileForm({ ...fileForm, language: e.target.value as CodeLanguage })}>
            <option value="python">Python (browser · Pyodide)</option>
            <option value="javascript">JavaScript (browser · Web Worker)</option>
            <option value="c">C (Sandbox execution demo)</option>
            <option value="java">Java (Sandbox execution demo)</option>
          </Select>
          {createFile.isError && <p className="text-sm text-rose-600">{createFile.error instanceof Error ? createFile.error.message : 'Failed'}</p>}
        </div>
      </Modal>

      <Modal
        open={submitModal}
        onClose={() => setSubmitModal(false)}
        title="Submit project"
        footer={
          <>
            <Button variant="outline" onClick={() => setSubmitModal(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={() => submit.mutate()} loading={submit.isPending} icon={<Send className="h-4 w-4" />}>
              {t('submit')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select label="Assignment" value={submitForm.assignmentId || p.assignmentId || ''} onChange={(e) => setSubmitForm({ ...submitForm, assignmentId: e.target.value })}>
            <option value="">— Mark as submitted without an assignment —</option>
            {assignments.data
              ?.filter((a) => a.type === 'project')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.className})
                </option>
              ))}
          </Select>
          <Textarea label="Note to teacher" rows={3} value={submitForm.note} onChange={(e) => setSubmitForm({ ...submitForm, note: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
