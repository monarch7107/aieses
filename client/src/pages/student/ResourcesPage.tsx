import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, Film, Globe2, MousePointerClick, Search } from 'lucide-react';
import { get } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, ErrorState, Input, Skeleton } from '@/components/ui';
import type { DikshaResource, LearningResource, Subject } from '@shared/types';

interface ResourcesResponse {
  resources: LearningResource[];
  diksha: { resources: DikshaResource[]; total: number; live: boolean; note: string } | null;
}

const typeIcon: Record<string, React.ReactNode> = {
  video: <Film className="h-4 w-4" />,
  article: <FileText className="h-4 w-4" />,
  interactive: <MousePointerClick className="h-4 w-4" />,
  pdf: <FileText className="h-4 w-4" />,
  diksha: <Globe2 className="h-4 w-4" />,
};

export function ResourcesPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const highlight = params.get('highlight');
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(query);
  const [subject, setSubject] = useState<string>('');
  useEffect(() => {
    const h = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(h);
  }, [query]);
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => get<{ subjects: Subject[] }>('/subjects').then((r) => r.subjects) });
  const data = useQuery({
    queryKey: ['resources', debounced, subject],
    queryFn: () => get<ResourcesResponse>(`/resources?q=${encodeURIComponent(debounced)}${subject ? `&subjectId=${subject}` : ''}`),
  });

  useEffect(() => {
    if (highlight && data.data) document.getElementById(`res-${highlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight, data.data]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t('resources')}</h1>
        <p className="mt-1 text-sm text-slate-600">Curated learning resources plus DIKSHA content discovered through the adapter interface.</p>
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input aria-label={t('searchResources')} placeholder={t('searchResources')} value={query} onChange={(e) => setQuery(e.target.value)} className="[&_input]:pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSubject('')} className={cn('rounded-full px-3 py-1.5 text-sm ring-1', !subject ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-300')}>
            All
          </button>
          {subjects.data?.map((s) => (
            <button key={s.id} type="button" onClick={() => setSubject(subject === s.id ? '' : s.id)} className={cn('rounded-full px-3 py-1.5 text-sm ring-1', subject === s.id ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-300')}>
              {s.icon} {s.name}
            </button>
          ))}
        </div>
      </div>

      {data.isError && <ErrorState error={data.error} onRetry={() => data.refetch()} />}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="AIESES library" subtitle={`${data.data?.resources.length ?? 0} resources`} />
          <CardBody className="space-y-2">
            {data.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
            {data.data?.resources.map((r) => (
              <a
                key={r.id}
                id={`res-${r.id}`}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('flex items-start gap-3 rounded-lg border p-3 transition hover:border-brand-300', highlight === r.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200')}
              >
                <span className="mt-0.5 rounded-md bg-slate-100 p-1.5 text-slate-600">{typeIcon[r.type]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{r.title}</span>
                    <Badge>{r.type}</Badge>
                    <Badge tone="neutral">{r.language.toUpperCase()}</Badge>
                    {r.isDemo && <Badge tone="warning">DEMO DATA</Badge>}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">{r.description}</span>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    {r.source} · {r.attribution}
                    {r.durationMin ? ` · ${r.durationMin} min` : ''}
                  </span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
              </a>
            ))}
            {data.data && data.data.resources.length === 0 && <EmptyState title="No matching resources" description="Try another search term or subject." />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                DIKSHA <Badge tone={data.data?.diksha?.live ? 'success' : 'warning'}>{data.data?.diksha?.live ? 'LIVE' : 'DEMO DATA'}</Badge>
              </span>
            }
            subtitle="National Digital Infrastructure for Knowledge Sharing — via the AIESES DIKSHA adapter"
          />
          <CardBody className="space-y-2">
            {data.data?.diksha && !data.data.diksha.live && (
              <Alert tone="warning" className="mb-2">
                {data.data.diksha.note}
              </Alert>
            )}
            {data.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
            {data.data?.diksha?.resources.map((r) => (
              <a key={r.identifier} href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-violet-300">
                <span className="mt-0.5 rounded-md bg-violet-50 p-1.5 text-violet-700">
                  <Globe2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                    <Badge tone="purple">{r.contentType}</Badge>
                    {r.isDemo && <Badge tone="warning">DEMO DATA</Badge>}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">{r.description}</span>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    {r.subject.join(', ')} · {r.gradeLevel.join(', ')} · {r.medium.join(', ')} · {r.attribution}
                  </span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
              </a>
            ))}
            {data.data?.diksha && data.data.diksha.resources.length === 0 && <EmptyState title="No DIKSHA results" description="The adapter returned no matches for this query." />}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
