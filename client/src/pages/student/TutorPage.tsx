import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Plus } from 'lucide-react';
import { get } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn, timeAgo } from '@/lib/utils';
import { Button, Card, CardHeader, PageHeader, Select } from '@/components/ui';
import { TutorPanel } from '@/components/tutor/TutorPanel';
import type { AIConversation, Course } from '@shared/types';

export function TutorPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [active, setActive] = useState<string | null>(params.get('c'));
  const [courseId, setCourseId] = useState<string>(params.get('course') ?? '');
  const conversations = useQuery({ queryKey: ['conversations'], queryFn: () => get<{ conversations: AIConversation[] }>('/ai/conversations').then((r) => r.conversations) });
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => get<{ courses: Course[] }>('/courses').then((r) => r.courses) });
  const selectedCourse = courses.data?.find((c) => c.id === courseId);

  return (
    <div>
      <PageHeader
        title={t('aiTutor')}
        subtitle="A curriculum-grounded tutor: explanations, simpler versions, examples, practice questions and study recommendations — in English, हिन्दी or தமிழ்."
        actions={
          <Button variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setActive(null)}>
            New chat
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="space-y-4 lg:col-span-1">
          <Card className="p-4">
            <Select label="Context course (optional)" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">General</option>
              {courses.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-xs text-slate-500">The tutor grounds its answers in the selected course and your mastery data.</p>
          </Card>
          <Card>
            <CardHeader title="Conversations" />
            <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
              {(conversations.data ?? []).map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setActive(c.id)} className={cn('flex w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-slate-50', active === c.id && 'bg-brand-50')}>
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{c.title}</span>
                      <span className="text-xs text-slate-500">{timeAgo(c.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
              {conversations.data?.length === 0 && <li className="px-4 py-4 text-sm text-slate-500">No conversations yet.</li>}
            </ul>
          </Card>
        </div>
        <div className="lg:col-span-3">
          <TutorPanel key={`${active ?? 'new'}-${courseId}`} initialConversationId={active} context={{ courseId: courseId || null, subjectId: selectedCourse?.subjectId ?? null }} className="min-h-[36rem]" />
        </div>
      </div>
    </div>
  );
}
