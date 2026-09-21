/**
 * Python runner — loads Pyodide (CPython compiled to WebAssembly) inside a Web Worker.
 * Code runs in the browser sandbox, never on the AIESES server. Requires network access to the
 * Pyodide CDN on first load; if unavailable the host falls back to the simulated runner.
 */
const ctx = self as unknown as { postMessage: (msg: unknown) => void; onmessage: ((e: MessageEvent) => void) | null };
export {};

const PYODIDE_VERSION = '0.26.4';
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`;

interface PyodideLike {
  runPythonAsync(code: string): Promise<unknown>;
  setStdout(opts: { batched: (s: string) => void }): void;
  setStderr(opts: { batched: (s: string) => void }): void;
}

let pyodidePromise: Promise<PyodideLike> | null = null;

function loadPyodide(): Promise<PyodideLike> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      ctx.postMessage({ type: 'status', message: 'Loading Python runtime (Pyodide, ~10 MB, first time only)…' });
      const mod = (await import(/* @vite-ignore */ PYODIDE_URL)) as { loadPyodide: (o: { indexURL: string }) => Promise<PyodideLike> };
      const py = await mod.loadPyodide({ indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/` });
      ctx.postMessage({ type: 'status', message: 'Python runtime ready.' });
      return py;
    })().catch((err) => {
      pyodidePromise = null;
      throw err;
    });
  }
  return pyodidePromise;
}

ctx.onmessage = async (e: MessageEvent<{ code: string; maxOutputChars: number }>) => {
  const { code, maxOutputChars } = e.data;
  const started = performance.now();
  let stdout = '';
  let stderr = '';
  try {
    const py = await loadPyodide();
    py.setStdout({
      batched: (s: string) => {
        if (stdout.length < maxOutputChars) stdout += s + '\n';
      },
    });
    py.setStderr({
      batched: (s: string) => {
        if (stderr.length < 4000) stderr += s + '\n';
      },
    });
    await py.runPythonAsync(code);
    ctx.postMessage({ type: 'result', status: 'success', stdout: stdout.slice(0, maxOutputChars), stderr, durationMs: Math.round(performance.now() - started) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const loadFailure = /Failed to fetch|import|NetworkError|Loading/i.test(message) && !pyodidePromise;
    ctx.postMessage({ type: 'result', status: loadFailure ? 'unavailable' : 'error', stdout, stderr: stderr + message, durationMs: Math.round(performance.now() - started) });
  }
};
