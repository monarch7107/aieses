import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bold, Columns2, Download, Eye, Heading2, Italic, List, ListOrdered, PencilLine, Quote, Save, Code as CodeIcon } from 'lucide-react';
import { ApiError, get, put } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Markdown, SafeHtml, sanitizeHtml } from '@/lib/markdown';
import { cn, downloadBlob, timeAgo } from '@/lib/utils';
import { Alert, Badge, Button, PageHeader, Select, Spinner, ErrorState, useToast } from '@/components/ui';
import type { Document, DocumentFormat, LanguageCode } from '@shared/types';

type Mode = 'edit' | 'split' | 'preview';

export function DocumentEditorPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [format, setFormat] = useState<DocumentFormat>('markdown');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [mode, setMode] = useState<Mode>('split');
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rteRef = useRef<HTMLDivElement>(null);

  const doc = useQuery({ queryKey: ['document', id], queryFn: () => get<{ document: Document }>(`/documents/${id}`).then((r) => r.document), enabled: !!id, staleTime: Infinity });
  useEffect(() => {
    if (doc.data && !dirty) {
      setTitle(doc.data.title);
      setContent(doc.data.content);
      setFormat(doc.data.format);
      setLanguage(doc.data.language);
      setLastSaved(doc.data.updatedAt);
      if (doc.data.format === 'richtext' && rteRef.current) rteRef.current.innerHTML = sanitizeHtml(doc.data.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.data]);

  const save = useMutation({
    mutationFn: () => put<{ document: Document }>(`/documents/${id}`, { title, content, format, language }),
    onSuccess: (res) => {
      setDirty(false);
      setLastSaved(res.document.updatedAt);
      qc.setQueryData(['document', id], res.document);
      qc.invalidateQueries({ queryKey: ['project', res.document.projectId] });
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : 'Save failed', 'danger'),
  });

  // Autosave 2s after the last change
  useEffect(() => {
    if (!dirty) return;
    const h = setTimeout(() => save.mutate(), 2000);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title, format, language, dirty]);

  // Keyboard shortcut Ctrl/Cmd+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save.mutate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const update = (next: string) => {
    setContent(next);
    setDirty(true);
  };

  const wrapSelection = useCallback(
    (before: string, after = before, placeholder = 'text') => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = content.slice(start, end) || placeholder;
      const next = content.slice(0, start) + before + selected + after + content.slice(end);
      update(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + before.length, start + before.length + selected.length);
      });
    },
    [content],
  );
  const prefixLines = useCallback(
    (prefix: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = content.lastIndexOf('\n', ta.selectionStart - 1) + 1;
      const end = ta.selectionEnd;
      const block = content.slice(start, end);
      const lines = block.split('\n').map((l, i) => (prefix === '1. ' ? `${i + 1}. ${l}` : prefix + l));
      update(content.slice(0, start) + lines.join('\n') + content.slice(end));
    },
    [content],
  );

  const exec = (cmd: string) => {
    document.execCommand(cmd, false);
    if (rteRef.current) update(rteRef.current.innerHTML);
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      if (dirty) await save.mutateAsync();
      const res = await fetch(`/api/documents/${id}/export.pdf`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      downloadBlob(blob, `${title.replace(/[^\w\u0900-\u097F\u0B80-\u0BFF -]+/g, '').trim() || 'document'}.pdf`);
      toast.show('PDF downloaded');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Export failed', 'danger');
    } finally {
      setExporting(false);
    }
  };

  if (doc.isLoading) return <Spinner />;
  if (doc.isError) return <ErrorState error={doc.error} onRetry={() => doc.refetch()} />;
  const d = doc.data!;
  const words = content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;

  const toolbarBtn = (icon: React.ReactNode, label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
      {icon}
    </button>
  );

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col">
      {toast.node}
      <PageHeader
        crumbs={[{ to: '/workspace', label: t('workspace') }, { to: `/projects/${d.projectId}`, label: 'Project' }, { label: title || 'Document' }]}
        title={
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            aria-label="Document title"
            className="w-full max-w-xl rounded-md border border-transparent bg-transparent px-1 text-2xl font-bold tracking-tight text-slate-900 hover:border-slate-300 focus:border-brand-500 focus:outline-none sm:text-3xl"
          />
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={dirty ? 'warning' : save.isPending ? 'info' : 'success'}>{save.isPending ? 'Saving…' : dirty ? 'Unsaved changes' : `${t('saved')} ${lastSaved ? timeAgo(lastSaved) : ''}`}</Badge>
            <span>{words} words</span>
          </span>
        }
        actions={
          <>
            <Select aria-label="Format" value={format} onChange={(e) => { setFormat(e.target.value as DocumentFormat); setDirty(true); }} className="w-32">
              <option value="markdown">Markdown</option>
              <option value="richtext">Rich text</option>
              <option value="text">Plain text</option>
            </Select>
            <Select aria-label="Document language" value={language} onChange={(e) => { setLanguage(e.target.value as LanguageCode); setDirty(true); }} className="w-28">
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="ta">தமிழ்</option>
            </Select>
            <Button variant="outline" icon={<Save className="h-4 w-4" />} onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
              {t('save')}
            </Button>
            <Button icon={<Download className="h-4 w-4" />} onClick={exportPdf} loading={exporting}>
              {t('exportPdf')}
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
          <div className="flex items-center gap-0.5">
            {format === 'markdown' && (
              <>
                {toolbarBtn(<Bold className="h-4 w-4" />, 'Bold', () => wrapSelection('**'))}
                {toolbarBtn(<Italic className="h-4 w-4" />, 'Italic', () => wrapSelection('_'))}
                {toolbarBtn(<Heading2 className="h-4 w-4" />, 'Heading', () => prefixLines('## '))}
                {toolbarBtn(<List className="h-4 w-4" />, 'Bullet list', () => prefixLines('- '))}
                {toolbarBtn(<ListOrdered className="h-4 w-4" />, 'Numbered list', () => prefixLines('1. '))}
                {toolbarBtn(<Quote className="h-4 w-4" />, 'Quote', () => prefixLines('> '))}
                {toolbarBtn(<CodeIcon className="h-4 w-4" />, 'Code', () => wrapSelection('`'))}
              </>
            )}
            {format === 'richtext' && (
              <>
                {toolbarBtn(<Bold className="h-4 w-4" />, 'Bold', () => exec('bold'))}
                {toolbarBtn(<Italic className="h-4 w-4" />, 'Italic', () => exec('italic'))}
                {toolbarBtn(<Heading2 className="h-4 w-4" />, 'Heading', () => { document.execCommand('formatBlock', false, 'h2'); if (rteRef.current) update(rteRef.current.innerHTML); })}
                {toolbarBtn(<List className="h-4 w-4" />, 'Bullet list', () => exec('insertUnorderedList'))}
                {toolbarBtn(<ListOrdered className="h-4 w-4" />, 'Numbered list', () => exec('insertOrderedList'))}
              </>
            )}
            {format === 'text' && <span className="px-2 text-xs text-slate-500">Plain text — no formatting</span>}
          </div>
          {format === 'markdown' && (
            <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
              {(
                [
                  ['edit', <PencilLine className="h-4 w-4" key="e" />, 'Edit'],
                  ['split', <Columns2 className="h-4 w-4" key="s" />, 'Split'],
                  ['preview', <Eye className="h-4 w-4" key="p" />, 'Preview'],
                ] as const
              ).map(([m, icon, label]) => (
                <button key={m} type="button" onClick={() => setMode(m)} aria-label={label} title={label} className={cn('rounded-md p-1.5', mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
                  {icon}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={cn('grid min-h-0 flex-1', format === 'markdown' && mode === 'split' ? 'md:grid-cols-2' : 'grid-cols-1')}>
          {format === 'markdown' && mode !== 'preview' && (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => update(e.target.value)}
              spellCheck={false}
              aria-label="Markdown source"
              className="h-full w-full resize-none border-0 bg-slate-50/60 p-5 font-mono text-sm leading-relaxed text-slate-800 focus:outline-none md:border-r md:border-slate-100"
              placeholder="# Start writing in Markdown…"
            />
          )}
          {format === 'markdown' && mode !== 'edit' && (
            <div className="h-full overflow-y-auto p-6">
              <Markdown content={content || '_Nothing to preview yet._'} />
            </div>
          )}
          {format === 'text' && <textarea value={content} onChange={(e) => update(e.target.value)} aria-label="Plain text" className="h-full w-full resize-none border-0 p-5 text-sm leading-relaxed text-slate-800 focus:outline-none" />}
          {format === 'richtext' && (
            <div
              ref={rteRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Rich text editor"
              data-placeholder="Start writing…"
              onInput={(e) => update((e.target as HTMLDivElement).innerHTML)}
              className="rte prose-aieses h-full overflow-y-auto p-6 focus:outline-none"
            />
          )}
        </div>
      </div>
      {format === 'richtext' && mode === 'preview' && <SafeHtml html={content} />}
      <Alert tone="info" className="mt-3 py-2 text-xs">
        Documents autosave 2 s after you stop typing (Ctrl/Cmd+S saves immediately). PDF export renders on the server with embedded Noto fonts for Devanagari and Tamil text.{' '}
        <Link to={`/projects/${d.projectId}`} className="font-medium underline">
          Back to project
        </Link>
      </Alert>
    </div>
  );
}
