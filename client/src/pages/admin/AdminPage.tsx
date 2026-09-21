import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, RefreshCw, Users } from 'lucide-react';
import { get, patch, post } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, ErrorState, PageHeader, Select, Spinner, StatCard, Tabs, useToast } from '@/components/ui';
import type { Role, User } from '@shared/types';

interface AdminStats {
  stats: {
    users: { total: number; students: number; teachers: number; admins: number };
    content: { subjects: number; courses: number; lessons: number; questions: number; resources: number; translations: number };
    activity: { attempts: number; lessonsCompleted: number; aiMessages: number; codeExecutions: number; projects: number; documents: number };
  };
  system: {
    version: string;
    environment: string;
    demoMode: boolean;
    database: { driver: string; path: string };
    ai: { provider: string; label: string; live: boolean };
    diksha: { mode: string; label: string };
    execution: { serverRunner: string; simulated: boolean; browserLanguages: string[]; serverLanguages: string[] };
    pdfFonts: { devanagari: boolean; tamil: boolean; latin: boolean };
    jwtSecretGenerated: boolean;
  };
}

export function AdminPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const data = useQuery({ queryKey: ['admin-stats'], queryFn: () => get<AdminStats>('/admin/stats') });
  const reseed = useMutation({
    mutationFn: () => post('/admin/reseed', { confirm: 'RESEED' }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.show('Demo data reset');
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : 'Failed', 'danger'),
  });
  if (data.isLoading) return <Spinner />;
  if (data.isError) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  const { stats, system } = data.data!;
  const Row = ({ k, v, tone }: { k: string; v: React.ReactNode; tone?: 'success' | 'warning' | 'danger' | 'neutral' }) => (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-600">{k}</span>
      {tone ? <Badge tone={tone}>{v}</Badge> : <span className="font-medium text-slate-900">{v}</span>}
    </div>
  );

  return (
    <div>
      {toast.node}
      <PageHeader
        title={t('admin')}
        subtitle="Platform status, content inventory and demo data management."
        actions={
          <Button variant="danger" icon={<RefreshCw className="h-4 w-4" />} loading={reseed.isPending} onClick={() => confirm('Reset ALL demo data to the seed state? This deletes user-created content.') && reseed.mutate()}>
            Reset demo data
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Users" value={stats.users.total} hint={`${stats.users.students} students · ${stats.users.teachers} teachers · ${stats.users.admins} admin`} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Lessons" value={stats.content.lessons} hint={`${stats.content.courses} courses · ${stats.content.subjects} subjects`} tone="info" />
        <StatCard label="Questions" value={stats.content.questions} hint={`${stats.content.resources} resources · ${stats.content.translations} translations`} tone="purple" />
        <StatCard label="Attempts" value={stats.activity.attempts} hint={`${stats.activity.aiMessages} AI msgs · ${stats.activity.codeExecutions} code runs`} tone="warning" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Database className="h-4 w-4" /> System status</span>} subtitle={`AIESES v${system.version} · ${system.environment}`} />
          <CardBody>
            <Row k="Demo mode" v={system.demoMode ? 'ON (one-click demo logins)' : 'OFF'} tone={system.demoMode ? 'warning' : 'success'} />
            <Row k="Database" v={`${system.database.driver} (${system.database.path})`} />
            <Row k="AI provider" v={system.ai.label} tone={system.ai.live ? 'success' : 'warning'} />
            <Row k="DIKSHA adapter" v={system.diksha.label} tone={system.diksha.mode === 'live' ? 'success' : 'warning'} />
            <Row k="Server code runner" v={`${system.execution.serverRunner} (${system.execution.serverLanguages.join(', ')})`} tone={system.execution.simulated ? 'warning' : 'success'} />
            <Row k="Browser code runners" v={system.execution.browserLanguages.join(', ')} />
            <Row k="PDF fonts" v={`Devanagari ${system.pdfFonts.devanagari ? '✓' : '✗'} · Tamil ${system.pdfFonts.tamil ? '✓' : '✗'}`} tone={system.pdfFonts.devanagari && system.pdfFonts.tamil ? 'success' : 'warning'} />
            <Row k="JWT secret" v={system.jwtSecretGenerated ? 'auto-generated (dev only)' : 'configured via env'} tone={system.jwtSecretGenerated ? 'warning' : 'success'} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Activity totals" />
          <CardBody>
            <Row k="Lessons completed" v={stats.activity.lessonsCompleted} />
            <Row k="Assessment attempts" v={stats.activity.attempts} />
            <Row k="AI tutor messages" v={stats.activity.aiMessages} />
            <Row k="Code executions" v={stats.activity.codeExecutions} />
            <Row k="Projects" v={stats.activity.projects} />
            <Row k="Documents" v={stats.activity.documents} />
          </CardBody>
        </Card>
      </div>
      <Alert tone="info" className="mt-6">
        Simulated / mock components are labelled in the UI: <strong>Demo Tutor provider</strong> (no external LLM unless AI_API_KEY is set), <strong>DIKSHA DEMO DATA</strong>, and <strong>Sandbox execution demo</strong> for C/Java. Configure environment variables to switch to live providers.
      </Alert>
    </div>
  );
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'all' | Role>('all');
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => get<{ users: User[] }>('/users').then((r) => r.users) });
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => patch(`/users/${id}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.show('Role updated');
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : 'Failed', 'danger'),
  });
  if (users.isLoading) return <Spinner />;
  if (users.isError) return <ErrorState error={users.error} onRetry={() => users.refetch()} />;
  const list = (users.data ?? []).filter((u) => tab === 'all' || u.role === tab);
  return (
    <div>
      {toast.node}
      <PageHeader title="Users" subtitle="All accounts (demo data). Roles can be changed here." />
      <Tabs className="mb-4 w-fit" value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All', count: users.data?.length }, { id: 'student', label: 'Students' }, { id: 'teacher', label: 'Teachers' }, { id: 'admin', label: 'Admins' }]} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Language</th>
              <th className="px-4 py-2">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2 font-medium text-slate-900">
                    <Avatar name={u.name} color={u.avatarColor} size="sm" /> {u.name}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">{u.email}</td>
                <td className="px-4 py-2">
                  <Badge>{u.language.toUpperCase()}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Select aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value as Role })} className="w-32">
                    <option value="student">student</option>
                    <option value="teacher">teacher</option>
                    <option value="admin">admin</option>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
