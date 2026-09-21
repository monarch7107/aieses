/**
 * JavaScript sandbox runner — executes student code inside a dedicated Web Worker.
 * The worker has no DOM access; network, timers and workers are disabled; output is captured
 * from console.* calls. The host terminates the worker on timeout.
 */
const ctx = self as unknown as { postMessage: (msg: unknown) => void; onmessage: ((e: MessageEvent) => void) | null };
export {};

interface RunRequest {
  code: string;
  maxOutputChars: number;
}

ctx.onmessage = (e: MessageEvent<RunRequest>) => {
  const { code, maxOutputChars } = e.data;
  const started = performance.now();
  let stdout = '';
  let stderr = '';
  let truncated = false;

  const append = (target: 'out' | 'err', parts: unknown[]) => {
    const line =
      parts
        .map((p) => {
          if (typeof p === 'string') return p;
          try {
            return JSON.stringify(p, null, 0);
          } catch {
            return String(p);
          }
        })
        .join(' ') + '\n';
    if (target === 'out') {
      if (stdout.length + line.length > maxOutputChars) {
        truncated = true;
        stdout += line.slice(0, Math.max(0, maxOutputChars - stdout.length));
      } else stdout += line;
    } else stderr += line.slice(0, 4000);
  };

  const sandboxConsole = {
    log: (...a: unknown[]) => append('out', a),
    info: (...a: unknown[]) => append('out', a),
    warn: (...a: unknown[]) => append('err', ['[warn]', ...a]),
    error: (...a: unknown[]) => append('err', ['[error]', ...a]),
    table: (a: unknown) => append('out', [a]),
  };

  // Shadow dangerous globals inside the sandboxed function scope.
  const blocked = ['fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'Worker', 'indexedDB', 'caches', 'setTimeout', 'setInterval', 'postMessage', 'self', 'globalThis'];
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('console', ...blocked, `"use strict";\n${code}`);
    const result = fn(sandboxConsole, ...blocked.map(() => undefined));
    if (result !== undefined) append('out', ['=>', result]);
    ctx.postMessage({ status: truncated ? 'error' : 'success', stdout, stderr: truncated ? stderr + '\n[output truncated]' : stderr, durationMs: Math.round(performance.now() - started) });
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    ctx.postMessage({ status: 'error', stdout, stderr: stderr + message, durationMs: Math.round(performance.now() - started) });
  }
};
