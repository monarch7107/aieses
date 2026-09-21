import { beforeAll, describe, expect, it } from 'vitest';
import { api, loginAs, type Session } from './helpers.js';
import { screenCode } from '../src/services/execution/index.js';

let student: Session;

beforeAll(async () => {
  student = await loginAs('student');
});

describe('code execution safety', () => {
  it('reports the execution capabilities honestly (simulated server runner)', async () => {
    const res = await api().get('/api/executions/status').set('Cookie', student.cookie);
    expect(res.status).toBe(200);
    expect(res.body.execution.simulated).toBe(true);
    expect(res.body.execution.serverRunner).toBe('simulated');
    expect(res.body.execution.browserLanguages).toEqual(['javascript', 'python']);
    expect(res.body.execution.serverLanguages).toEqual(['c', 'java']);
  });

  it('refuses to run browser languages on the server', async () => {
    const js = await api().post('/api/executions/run').set('Cookie', student.cookie).send({ language: 'javascript', code: 'console.log(1)' });
    expect(js.status).toBe(400);
    const py = await api().post('/api/executions/run').set('Cookie', student.cookie).send({ language: 'python', code: 'print(1)' });
    expect(py.status).toBe(400);
  });

  it('simulates C and Java output and labels the result as simulated', async () => {
    const c = await api().post('/api/executions/run').set('Cookie', student.cookie).send({ language: 'c', code: '#include <stdio.h>\nint main() { printf("Hello AIESES\\n"); printf("Sum: %d\\n", 2 + 3); return 0; }' });
    expect(c.status).toBe(200);
    expect(c.body.result.simulated).toBe(true);
    expect(c.body.result.runner).toBe('simulated');
    expect(c.body.result.status).toBe('success');
    expect(c.body.result.stdout).toContain('Hello AIESES');
    expect(c.body.result.id).toMatch(/^exe_/);
    const java = await api().post('/api/executions/run').set('Cookie', student.cookie).send({ language: 'java', code: 'public class Main { public static void main(String[] a) { System.out.println("Hi from Java"); } }' });
    expect(java.body.result.stdout).toContain('Hi from Java');
    expect(java.body.result.simulated).toBe(true);
  });

  it('blocks dangerous constructs with the static screen before any runner is invoked', async () => {
    const res = await api().post('/api/executions/run').set('Cookie', student.cookie).send({ language: 'c', code: '#include <stdlib.h>\nint main() { system("rm -rf /"); return 0; }' });
    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('blocked');
    expect(res.body.result.stderr).toMatch(/blocked|not allowed|forbidden/i);
    expect(screenCode('Runtime.getRuntime().exec("ls")').ok).toBe(false);
    expect(screenCode('#include <sys/socket.h>').ok).toBe(false);
    expect(screenCode('fork();').ok).toBe(false);
    expect(screenCode('printf("safe");').ok).toBe(true);
  });

  it('enforces the code size limit', async () => {
    const res = await api().post('/api/executions/run').set('Cookie', student.cookie).send({ language: 'c', code: 'x'.repeat(200_000) });
    expect(res.status).toBe(400);
  });

  it('records browser-sandbox runs and lists them for the student', async () => {
    const rec = await api().post('/api/executions').set('Cookie', student.cookie).send({ language: 'javascript', runner: 'browser-worker', status: 'success', stdout: 'Total: 323\n', stderr: '', durationMs: 12 });
    expect(rec.status).toBe(201);
    const list = await api().get('/api/executions/me').set('Cookie', student.cookie);
    expect(list.status).toBe(200);
    expect(list.body.executions[0].runner).toBe('browser-worker');
    const bad = await api().post('/api/executions').set('Cookie', student.cookie).send({ language: 'javascript', runner: 'host-shell', status: 'success' });
    expect(bad.status).toBe(400);
  });
});
