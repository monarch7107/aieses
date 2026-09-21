import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { FilePlus2, FolderKanban, Play, Save, ShieldCheck, Square, Trash2 } from 'lucide-react';
import { del, get, post, put } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { runCode } from '@/lib/runner';
import { cn, timeAgo } from '@/lib/utils';
import { Alert, Badge, Button, Input, Modal, Select, Spinner, useToast } from '@/components/ui';
import type { CodeFile, CodeLanguage, ExecutionResult, FileSummary, Project } from '@shared/types';

const LANGS: { id: CodeLanguage; label: string; runner: string; ext: string }[] = [
  { id: 'python', label: 'Python', runner: 'Browser · Pyodide (WebAssembly)', ext: 'py' },
  { id: 'javascript', label: 'JavaScript', runner: 'Browser · Web Worker sandbox', ext: 'js' },
  { id: 'c', label: 'C', runner: 'Sandbox execution demo (simulated)', ext: 'c' },
  { id: 'java', label: 'Java', runner: 'Sandbox execution demo (simulated)', ext: 'java' },
];

const SCRATCH: Record<CodeLanguage, string> = {
  python: `# Python runs in your browser via Pyodide (WebAssembly)\nmarks = [78, 92, 65, 88]\ntotal = sum(marks)\nprint("Total:", total)\nprint("Average:", total / len(marks))\n`,
  javascript: `// JavaScript runs in your browser's Web Worker sandbox\nconst marks = [78, 92, 65, 88];\nconst total = marks.reduce((sum, m) => sum + m, 0);\nconsole.log("Total:", total);\nconsole.log("Average:", total / marks.length);\n`,
  c: `#include <stdio.h>\n\nint main() {\n    int marks[] = {78, 92, 65, 88};\n    int total = 0;\n    for (int i = 0; i < 4; i++) total += marks[i];\n    printf("Total: %d\\n", total);\n    return 0;\n}\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        int[] marks = {78, 92, 65, 88};\n        int total = 0;\n        for (int m : marks) total += m;\n        System.out.println("Total: " + total);\n    }\n}\n`,
};

function extensionFor(lang: CodeLanguage) {
  switch (lang) {
    case 'javascript':
      return javascript();
    case 'python':
      return python();
    case 'c':
      return cpp();
    case 'java':
      return java();
  }
}

export function IdePage() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const fileId = params.get('file');
  const [language, setLanguage] = useState<CodeLanguage>('python');
  const [code, setCode] = useState(SCRATCH.python);
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [history, setHistory] = useState<ExecutionResult[]>([]);
  const [newFile, setNewFile] = useState<{ open: boolean; name: string; language: CodeLanguage }>({ open: false, name: 'main.py', language: 'python' });
  const abortRef = useRef<{ cancelled: boolean } | null>(null);

  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => get<{ project: Project }>(`/projects/${projectId}`).then((r) => r.project), enabled: !!projectId });
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => get<{ projects: Project[] }>('/projects').then((r) => r.projects), enabled: !projectId });
  const file = useQuery({ queryKey: ['file', fileId], queryFn: () => get<{ file: CodeFile }>(`/files/${fileId}`).then((r) => r.file), enabled: !!fileId, staleTime: Infinity });

  useEffect(() => {
    if (file.data) {
      setCode(file.data.content);
      setLanguage(file.data.language);
      setDirty(false);
      setResult(null);
    }
  }, [file.data]);

  // Auto-open the first file of a project when none selected
  useEffect(() => {
    if (projectId && !fileId && project.data?.files?.length) setParams({ file: project.data.files[0].id }, { replace: true });
  }, [projectId, fileId, project.data, setParams]);

  const save = useMutation({
    mutationFn: () => put<{ file: CodeFile }>(`/files/${fileId}`, { content: code, language }),
    onSuccess: (res) => {
      setDirty(false);
      qc.setQueryData(['file', fileId], res.file);
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : 'Save failed', 'danger'),
  });
  const create = useMutation({
    mutationFn: () => post<{ file: CodeFile }>('/files', { projectId, name: newFile.name, language: newFile.language }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      setNewFile({ ...newFile, open: false });
      setParams({ file: res.file.id });
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : 'Failed', 'danger'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/files/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      setParams({});
    },
  });

  useEffect(() => {
    if (!dirty || !fileId) return;
    const h = setTimeout(() => save.mutate(), 1500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, dirty, fileId]);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setStatus(null);
    setResult(null);
    const token = { cancelled: false };
    abortRef.current = token;
    try {
      if (fileId && dirty) await save.mutateAsync();
      const res = await runCode(language, code, { fileId, onStatus: setStatus });
      if (token.cancelled) return;
      setResult(res);
      setHistory((h) => [res, ...h].slice(0, 10));
      qc.invalidateQueries({ queryKey: ['progress'] });
    } catch (e) {
      if (!token.cancelled) setResult({ language, runner: 'simulated', runnerLabel: 'Error', simulated: true, status: 'error', stdout: '', stderr: e instanceof Error ? e.message : 'Run failed', durationMs: 0 });
    } finally {
      if (!token.cancelled) setRunning(false);
    }
  }, [running, fileId, dirty, save, language, code, qc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        run();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (fileId) save.mutate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, save, fileId]);

  const stop = () => {
    if (abortRef.current) abortRef.current.cancelled = true;
    setRunning(false);
    setStatus('Stopped by user.');
  };

  const extensions = useMemo(() => [extensionFor(language)], [language]);
  const lang = LANGS.find((l) => l.id === language)!;
  const files: FileSummary[] = project.data?.files ?? [];

  const onChangeLanguage = (next: CodeLanguage) => {
    setLanguage(next);
    if (!fileId && !dirty) setCode(SCRATCH[next]);
    setDirty(!!fileId);
  };

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col">
      {toast.node}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {t('ide')} {project.data && <span className="text-slate-400">· {project.data.title}</span>}
          </h1>
          <p className="text-xs text-slate-500">
            {lang.runner} · time limit 5 s (JS) · output capped · code never runs on the AIESES server <ShieldCheck className="inline h-3.5 w-3.5 text-emerald-600" />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Language" value={language} onChange={(e) => onChangeLanguage(e.target.value as CodeLanguage)} className="w-40">
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
          {fileId && (
            <Button variant="outline" icon={<Save className="h-4 w-4" />} onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
              {dirty ? t('save') : t('saved')}
            </Button>
          )}
          {running ? (
            <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={stop}>
              {t('stop')}
            </Button>
          ) : (
            <Button variant="success" icon={<Play className="h-4 w-4" />} onClick={run}>
              {t('run')} <span className="hidden text-xs opacity-70 sm:inline">Ctrl+↵</span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[14rem_1fr]">
        {/* File explorer */}
        <aside className="hidden min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:flex">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Files</span>
            {projectId && (
              <button type="button" onClick={() => setNewFile({ ...newFile, open: true })} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label={t('newFile')} title={t('newFile')}>
                <FilePlus2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {!projectId && (
              <div className="px-3 py-2 text-xs text-slate-500">
                <p className="font-medium text-slate-700">Scratchpad</p>
                <p className="mt-1">Unsaved playground. Open a project to save files:</p>
                <ul className="mt-2 space-y-1">
                  {projects.data?.map((p) => (
                    <li key={p.id}>
                      <Link to={`/ide/${p.id}`} className="flex items-center gap-1 text-brand-700 hover:underline">
                        <FolderKanban className="h-3 w-3" /> {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {files.map((f) => (
              <div key={f.id} className={cn('group flex items-center justify-between px-3 py-1.5 text-sm', f.id === fileId ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-50')}>
                <button type="button" onClick={() => setParams({ file: f.id })} className="min-w-0 flex-1 truncate text-left font-mono text-xs">
                  {f.name}
                </button>
                <button type="button" onClick={() => confirm(`Delete ${f.name}?`) && remove.mutate(f.id)} className="rounded p-0.5 text-slate-400 opacity-0 hover:text-rose-600 group-hover:opacity-100" aria-label={`Delete ${f.name}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {projectId && files.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">No files. Create one.</p>}
          </div>
          {project.data && (
            <div className="border-t border-slate-100 px-3 py-2 text-xs">
              <Link to={`/projects/${project.data.id}`} className="text-brand-700 hover:underline">
                ← Project overview
              </Link>
            </div>
          )}
        </aside>

        {/* Editor + console */}
        <div className="grid min-h-0 grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-3">
          <div className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 text-xs text-slate-500">
              <span className="font-mono">{file.data?.name ?? `scratch.${lang.ext}`}</span>
              <span>{file.data ? `saved ${timeAgo(file.data.updatedAt)}` : 'not saved'}</span>
            </div>
            {file.isLoading ? (
              <Spinner />
            ) : (
              <CodeMirror
                value={code}
                height="100%"
                className="h-[calc(100%-2rem)]"
                extensions={extensions}
                onChange={(v) => {
                  setCode(v);
                  setDirty(true);
                }}
                basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true, highlightActiveLine: true }}
              />
            )}
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-1.5 text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-400">{t('output')}</span>
              <span className="flex items-center gap-2">
                {result && <Badge tone={result.status === 'success' ? 'success' : result.status === 'timeout' ? 'warning' : 'danger'}>{result.status}</Badge>}
                {result && <span className="text-slate-400">{result.durationMs} ms</span>}
                {result && <Badge tone={result.simulated ? 'warning' : 'info'}>{result.simulated ? 'Sandbox execution demo' : result.runnerLabel}</Badge>}
              </span>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-sm" aria-live="polite">
              {running && <span className="text-slate-400">{status ?? 'Running…'}</span>}
              {!running && !result && <span className="text-slate-500">Press Run (Ctrl+Enter) to execute your program.</span>}
              {!running && result && (
                <>
                  {result.note && <span className="block text-amber-300">⚠ {result.note}</span>}
                  {result.stdout && <span className="block">{result.stdout}</span>}
                  {result.stderr && <span className="block text-rose-300">{result.stderr}</span>}
                  {!result.stdout && !result.stderr && <span className="text-slate-500">(no output)</span>}
                </>
              )}
            </pre>
            {history.length > 1 && (
              <div className="flex gap-1 overflow-x-auto border-t border-slate-800 px-3 py-1 text-[11px] text-slate-400">
                {history.map((h, i) => (
                  <button key={i} type="button" onClick={() => setResult(h)} className={cn('rounded px-1.5 py-0.5 hover:bg-slate-800', h === result && 'bg-slate-800 text-slate-100')}>
                    run {history.length - i}: {h.status}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {(language === 'c' || language === 'java') && (
        <Alert tone="warning" className="mt-3 py-2 text-xs">
          C and Java are executed by the <strong>Sandbox execution demo</strong>: a static screen plus a deterministic simulator that recognises common print statements. No compiler runs on the AIESES server. A real isolated runner (e.g. Piston/Docker) plugs into the same adapter interface.
        </Alert>
      )}

      <Modal
        open={newFile.open}
        onClose={() => setNewFile({ ...newFile, open: false })}
        title={t('newFile')}
        footer={
          <>
            <Button variant="outline" onClick={() => setNewFile({ ...newFile, open: false })}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="File name" value={newFile.name} onChange={(e) => setNewFile({ ...newFile, name: e.target.value })} />
          <Select label="Language" value={newFile.language} onChange={(e) => setNewFile({ ...newFile, language: e.target.value as CodeLanguage, name: newFile.name.replace(/\.\w+$/, '') + '.' + LANGS.find((l) => l.id === e.target.value)!.ext })}>
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  );
}
