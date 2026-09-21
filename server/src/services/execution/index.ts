/**
 * Code execution adapter (server side).
 *
 * SECURITY MODEL
 *  - JavaScript and Python are executed in the STUDENT'S BROWSER (Web Worker / Pyodide WASM),
 *    never on the application server. The server only records the result.
 *  - For languages with no browser sandbox (C, Java) the server delegates to an ExecutionAdapter:
 *      • SimulatedRunner  → deterministic "Sandbox execution demo" (clearly labelled, default)
 *      • PistonRunner     → remote Piston-compatible sandbox API (opt-in, EXEC_PROVIDER=piston)
 *  - Under no configuration does the server spawn a process to run user code on the host.
 */
import { config } from '../../config.js';
import type { CodeLanguage, ExecutionResult } from '@shared/types';

export interface ExecutionAdapter {
  readonly id: ExecutionResult['runner'];
  readonly label: string;
  run(input: { language: CodeLanguage; code: string; stdin?: string }): Promise<ExecutionResult>;
}

export const BROWSER_LANGUAGES: CodeLanguage[] = ['javascript', 'python'];
export const SERVER_LANGUAGES: CodeLanguage[] = ['c', 'java'];

function truncate(s: string, max = config.exec.maxOutputBytes): string {
  return s.length > max ? s.slice(0, max) + '\n… [output truncated]' : s;
}

/** Extracts printf/System.out string literals to produce a plausible, clearly-labelled demo output. */
export class SimulatedRunner implements ExecutionAdapter {
  readonly id = 'simulated' as const;
  readonly label = 'Sandbox execution demo (simulated — no code is executed)';

  async run({ language, code }: { language: CodeLanguage; code: string }): Promise<ExecutionResult> {
    const started = Date.now();
    const lines: string[] = [];
    if (language === 'c') {
      const patterns = [/printf\s*\(\s*"((?:[^"\\]|\\.)*)"/g, /puts\s*\(\s*"((?:[^"\\]|\\.)*)"/g];
      for (const re of patterns) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(code))) {
          const text = m[1].replace(/\\n/g, '\n').replace(/%[-+ 0-9.]*(l{0,2}[dsfcxu]|lf)/g, '<value>');
          lines.push(re === patterns[1] ? `${text}\n` : text);
        }
      }
    } else {
      // System.out.println("Total: " + total)  →  Total: <value>
      const re = /System\.out\.print(ln)?\s*\(([^;]*)\)\s*;/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code))) {
        const args = m[2];
        const parts = args.split(/\s*\+\s*(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((p) => p.trim());
        const text = parts.map((p) => (/^"(?:[^"\\]|\\.)*"$/.test(p) ? p.slice(1, -1).replace(/\\n/g, '\n') : /^-?\d+(\.\d+)?$/.test(p) ? p : '<value>')).join('');
        lines.push(m[1] ? `${text}\n` : text);
      }
    }
    const hasMain = language === 'c' ? /int\s+main\s*\(/.test(code) : /public\s+static\s+void\s+main/.test(code);
    const stderr = hasMain ? '' : language === 'c' ? 'warning: no main() function found' : 'warning: no public static void main found';
    const stdout = lines.length ? lines.join('') : '(no printed output detected)';
    return {
      language,
      runner: this.id,
      runnerLabel: this.label,
      simulated: true,
      status: 'success',
      stdout: truncate(stdout),
      stderr,
      durationMs: Date.now() - started,
      note: 'SIMULATED: no code was compiled or executed. This demo runner echoes print statements and shows <value> where an expression would be evaluated. Configure EXEC_PROVIDER=piston for real sandboxed execution.',
    };
  }
}

/** Remote Piston-compatible sandbox (https://github.com/engineer-man/piston). Opt-in; unverified from this environment. */
export class PistonRunner implements ExecutionAdapter {
  readonly id = 'piston' as const;
  readonly label = 'Remote Piston sandbox';
  private fallback = new SimulatedRunner();

  async run(input: { language: CodeLanguage; code: string; stdin?: string }): Promise<ExecutionResult> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.exec.timeoutMs + 5000);
    try {
      const map: Record<CodeLanguage, { language: string; version: string; file: string }> = {
        c: { language: 'c', version: '*', file: 'main.c' },
        java: { language: 'java', version: '*', file: 'Main.java' },
        python: { language: 'python', version: '*', file: 'main.py' },
        javascript: { language: 'javascript', version: '*', file: 'main.js' },
      };
      const target = map[input.language];
      const res = await fetch(`${config.exec.pistonBaseUrl.replace(/\/$/, '')}/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          language: target.language,
          version: target.version,
          files: [{ name: target.file, content: input.code }],
          stdin: input.stdin ?? '',
          run_timeout: config.exec.timeoutMs,
          compile_timeout: 10000,
          run_memory_limit: 128 * 1024 * 1024,
        }),
      });
      if (!res.ok) throw new Error(`Piston HTTP ${res.status}`);
      const data = (await res.json()) as { run?: { stdout?: string; stderr?: string; code?: number; signal?: string | null }; compile?: { stderr?: string; code?: number } };
      const compileErr = data.compile && data.compile.code ? data.compile.stderr ?? '' : '';
      const timedOut = data.run?.signal === 'SIGKILL';
      return {
        language: input.language,
        runner: this.id,
        runnerLabel: this.label,
        simulated: false,
        status: timedOut ? 'timeout' : compileErr || (data.run?.code ?? 0) !== 0 ? 'error' : 'success',
        stdout: truncate(data.run?.stdout ?? ''),
        stderr: truncate(compileErr || data.run?.stderr || ''),
        durationMs: Date.now() - started,
      };
    } catch (err) {
      const sim = await this.fallback.run(input);
      return { ...sim, note: `Remote sandbox unavailable (${(err as Error).message}); showing simulated demo output instead.` };
    } finally {
      clearTimeout(timer);
    }
  }
}

let adapter: ExecutionAdapter | null = null;
export function getExecutionAdapter(): ExecutionAdapter {
  if (adapter) return adapter;
  adapter = config.exec.provider === 'piston' ? new PistonRunner() : new SimulatedRunner();
  return adapter;
}

export function executionStatus() {
  const a = getExecutionAdapter();
  return {
    browserLanguages: BROWSER_LANGUAGES,
    serverLanguages: SERVER_LANGUAGES,
    serverRunner: a.id,
    serverRunnerLabel: a.label,
    simulated: a.id === 'simulated',
    timeoutMs: config.exec.timeoutMs,
    maxCodeBytes: config.exec.maxCodeBytes,
  };
}

/** Static safety screen applied before any server-side execution request. */
/**
 * Static deny-list applied to every server-side run request BEFORE any runner is invoked.
 * It is defence in depth for a future real runner (Piston/Docker): process control, networking,
 * file-system access, reflection/native loading and inline assembly are rejected outright.
 */
const BLOCKED_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\bsystem\s*\(/, reason: 'system() calls are not allowed' },
  { re: /\b(popen|execl|execlp|execle|execv|execvp|execve|fork|vfork|clone|kill|ptrace|dlopen|mmap|setuid|setgid|chroot)\s*\(/, reason: 'process control calls are not allowed' },
  { re: /#\s*include\s*<\s*(sys\/[^>]+|unistd\.h|windows\.h|netinet\/[^>]+|arpa\/[^>]+|netdb\.h|dlfcn\.h|signal\.h|pthread\.h|dirent\.h)\s*>/, reason: 'system / network headers are not allowed' },
  { re: /\b(socket|connect|bind|listen|accept|send|recv|sendto|recvfrom|gethostbyname|getaddrinfo)\s*\(/, reason: 'networking is not allowed' },
  { re: /\b(fopen|freopen|remove|rename|unlink|rmdir|mkdir|opendir|chmod|chown|tmpfile|open|creat)\s*\(/, reason: 'file-system access is not allowed' },
  { re: /\b(__asm__|asm)\b/, reason: 'inline assembly is not allowed' },
  { re: /Runtime\s*\.\s*getRuntime|ProcessBuilder|\bProcess\b\s*[=;]/, reason: 'process control is not allowed' },
  { re: /java\s*\.\s*(net|nio\.file|nio\.channels|lang\.reflect|lang\.instrument|security|rmi)\b/, reason: 'network / file / reflection APIs are not allowed' },
  { re: /\bjava\s*\.\s*io\s*\.\s*(File|FileInputStream|FileOutputStream|FileReader|FileWriter|RandomAccessFile)\b/, reason: 'file-system access is not allowed' },
  { re: /\b(Class\s*\.\s*forName|System\s*\.\s*(load|loadLibrary|exit|setSecurityManager)|Unsafe|Thread\s*\.\s*(sleep|start)|new\s+Thread)\b/, reason: 'reflection / native / thread APIs are not allowed' },
  { re: /\b(while\s*\(\s*(true|1)\s*\)\s*;)/, reason: 'empty infinite loops are not allowed' },
];

export function screenCode(code: string): { ok: true } | { ok: false; reason: string } {
  if (Buffer.byteLength(code, 'utf8') > config.exec.maxCodeBytes) return { ok: false, reason: `Code exceeds ${config.exec.maxCodeBytes} bytes` };
  if (/\0/.test(code)) return { ok: false, reason: 'Binary content is not allowed' };
  const stripped = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const { re, reason } of BLOCKED_PATTERNS) {
    if (re.test(stripped)) return { ok: false, reason: `Blocked by static screen: ${reason}` };
  }
  return { ok: true };
}
