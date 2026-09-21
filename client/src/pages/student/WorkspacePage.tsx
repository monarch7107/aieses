import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Code2, FileText, FolderKanban, Plus } from 'lucide-react';
import { get, post } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { timeAgo } from '@/lib/utils';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Spinner, Textarea } from '@/components/ui';
import type { Assignment, Project } from '@shared/types';

export function WorkspacePage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'mixed' as Project['type'], starter: 'markdown' as 'none' | 'markdown' | 'python' | 'javascript', assignmentId: '' });
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => get<{ projects: Project[] }>('/projects').then((r) => r.projects) });
  const assignments = useQuery({ queryKey: ['assignments'], queryFn: () => get<{ assignments: Assignment[] }>('/assignments').then((r) => r.assignments), enabled: open });
  const create = useMutation({
    mutationFn: () => post<{ project: Project }>('/projects', { title: form.title, description: form.description, type: form.type, starter: form.starter, assignmentId: form.assignmentId || null }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setOpen(false);
      navigate(`/projects/${res.project.id}`);
    },
  });

  if (projects.isLoading) return <Spinner />;
  if (projects.isError) return <ErrorState error={projects.error} onRetry={() => projects.refetch()} />;
  const list = projects.data ?? [];

  return (
    <div>
      <PageHeader
        title={t('workspace')}
        subtitle="Projects group your documents (markdown / rich text → PDF) and code files (browser sandbox runner). Submit a project to an assignment when it is ready."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            {t('newProject')}
          </Button>
        }
      />
      {list.length === 0 && <EmptyState icon={<FolderKanban className="h-8 w-8" />} title="No projects yet" description="Create a project to start writing documents or code." action={<Button onClick={() => setOpen(true)}>{t('newProject')}</Button>} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="group">
            <Card className="h-full p-5 transition group-hover:border-brand-300 group-hover:shadow-md">
              <div className="flex items-center justify-between">
                <Badge tone={p.type === 'code' ? 'info' : p.type === 'document' ? 'purple' : 'neutral'}>{p.type}</Badge>
                <Badge tone={p.status === 'submitted' ? 'success' : 'warning'}>{p.status}</Badge>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-slate-900 group-hover:text-brand-800">{p.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.description || 'No description'}</p>
              <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> {p.documents?.length ?? 0} docs
                </span>
                <span className="flex items-center gap-1">
                  <Code2 className="h-3.5 w-3.5" /> {p.files?.length ?? 0} files
                </span>
                <span className="ml-auto">{timeAgo(p.updatedAt)}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('newProject')}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={form.title.trim().length < 2}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Shadows experiment report" autoFocus />
          <Textarea label="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Project['type'] })}>
              <option value="mixed">Mixed (docs + code)</option>
              <option value="document">Document</option>
              <option value="code">Code</option>
            </Select>
            <Select label="Starter content" value={form.starter} onChange={(e) => setForm({ ...form, starter: e.target.value as typeof form.starter })}>
              <option value="markdown">Markdown report template</option>
              <option value="python">Python starter file</option>
              <option value="javascript">JavaScript starter file</option>
              <option value="none">Empty</option>
            </Select>
          </div>
          <Select label="Link to assignment (optional)" value={form.assignmentId} onChange={(e) => setForm({ ...form, assignmentId: e.target.value })}>
            <option value="">— None —</option>
            {assignments.data
              ?.filter((a) => a.type === 'project')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.className})
                </option>
              ))}
          </Select>
          {create.isError && <p className="text-sm text-rose-600">{create.error instanceof Error ? create.error.message : 'Failed to create'}</p>}
        </div>
      </Modal>
    </div>
  );
}
