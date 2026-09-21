/**
 * Client-side execution orchestrator.
 *  - JavaScript → dedicated Web Worker (terminated on timeout)
 *  - Python     → Pyodide (WebAssembly) in a Web Worker; falls back to server "Sandbox execution demo" if the runtime cannot load
 *  - C / Java   → server-side SimulatedRunner ("Sandbox execution demo") — never executed for real on the app server
 * Every run is recorded via POST /api/executions for the activity log.
 */
import { post } from './api';
import type { CodeLanguage, ExecutionResult } from '@shared/types';

export const RUN_TIMEOUT_MS = 5000;
export const MAX_OUTPUT_CHARS = 20_000;

const RUNNER_LABELS = {
  'browser-worker': 'Browser Web Worker sandbox',
  'pyodide-wasm': 'Pyodide (WebAssembly) in browser',
  simulated: 'Sandbox execution demo (simulated)',
} as const;

let pyWorker: Worker | null = null;

function makeJsWorker(): Worker {
  return new Worker(new URL('../workers/jsRunner.worker.ts', import.meta.url), { type: 'module' });
}
function getPyWorker(): Worker {
  if (!pyWorker) pyWorker = new Worker(new URL('../workers/pyRunner.worker.ts', import.meta.url), { type: 'module' });
  return pyWorker;
}

type Raw = { status: 'success' | 'error' | 'unavailable'; stdout: string; stderr: string; durationMs: number };

function runInWorker(worker: Worker, code: string, timeoutMs: number, onStatus?: (s: string) => void, terminateOnTimeout = true): Promise<Raw | { status: 'timeout'; stdout: string; stderr: string; durationMs: number }> {
  return new Promise((resolve) => {
    let done = false;
    const started = performance.now();
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      if (terminateOnTimeout) worker.terminate();
      else {
        // Pyodide worker is shared; reset it so the next run starts fresh.
        worker.terminate();
        pyWorker = null;
      }
      resolve({ status: 'timeout', stdout: '', stderr: `Execution stopped after ${timeoutMs / 1000}s (time limit).`, durationMs: Math.round(performance.now() - started) });
    }, timeoutMs);
    worker.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'status') {
        onStatus?.(e.data.message);
        return;
      }
      if (done) return;
      done = true;
      clearTimeout(timer);
      const d = e.data?.type === 'result' ? e.data : e.data;
      resolve({ status: d.status, stdout: d.stdout ?? '', stderr: d.stderr ?? '', durationMs: d.durationMs ?? Math.round(performance.now() - started) });
      if (terminateOnTimeout) worker.terminate();
    };
    worker.onerror = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ status: 'error', stdout: '', stderr: err.message || 'Worker error', durationMs: Math.round(performance.now() - started) });
      if (terminateOnTimeout) worker.terminate();
    };
    worker.postMessage({ code, maxOutputChars: MAX_OUTPUT_CHARS });
  });
}

async function record(result: ExecutionResult, _code: string, fileId?: string | null): Promise<ExecutionResult> {
  try {
    const saved = await post<{ id: string }>('/executions', { language: result.language, runner: result.runner, status: result.status, stdout: result.stdout.slice(0, MAX_OUTPUT_CHARS), stderr: result.stderr.slice(0, 4000), durationMs: result.durationMs, fileId: fileId ?? null });
    return { ...result, id: saved.id };
  } catch {
    return result;
  }
}

export async function runServerSimulated(language: CodeLanguage, code: string, fileId?: string | null): Promise<ExecutionResult> {
  const res = await post<{ result: ExecutionResult }>('/executions/run', { language, code, fileId: fileId ?? null });
  return res.result;
}

export async function runCode(language: CodeLanguage, code: string, opts: { fileId?: string | null; onStatus?: (s: string) => void } = {}): Promise<ExecutionResult> {
  if (language === 'javascript') {
    const raw = await runInWorker(makeJsWorker(), code, RUN_TIMEOUT_MS, opts.onStatus);
    const result: ExecutionResult = { language, runner: 'browser-worker', runnerLabel: RUNNER_LABELS['browser-worker'], simulated: false, status: raw.status === 'unavailable' ? 'error' : raw.status, stdout: raw.stdout, stderr: raw.stderr, durationMs: raw.durationMs };
    return record(result, code, opts.fileId);
  }
  if (language === 'python') {
    const raw = await runInWorker(getPyWorker(), code, 60_000, opts.onStatus, false);
    if (raw.status === 'unavailable') {
      opts.onStatus?.('Pyodide runtime unavailable (offline?) — falling back to Sandbox execution demo.');
      const sim = await runServerSimulated(language, code, opts.fileId);
      return { ...sim, note: `${sim.note ? sim.note + ' ' : ''}Browser Python runtime could not be loaded: ${raw.stderr.slice(0, 200)}` };
    }
    const result: ExecutionResult = { language, runner: 'pyodide-wasm', runnerLabel: RUNNER_LABELS['pyodide-wasm'], simulated: false, status: raw.status as ExecutionResult['status'], stdout: raw.stdout, stderr: raw.stderr, durationMs: raw.durationMs };
    return record(result, code, opts.fileId);
  }
  return runServerSimulated(language, code, opts.fileId);
}
