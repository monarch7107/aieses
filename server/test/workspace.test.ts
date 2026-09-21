import { beforeAll, describe, expect, it } from 'vitest';
import { api, loginAs, type Session } from './helpers.js';

let student: Session;
let projectId: string;
let documentId: string;
let fileId: string;

beforeAll(async () => {
  student = await loginAs('student');
});

describe('projects, documents, PDF export, files', () => {
  it('creates a project with starter content', async () => {
    const res = await api().post('/api/projects').set('Cookie', student.cookie).send({ title: 'Test Project', description: 'created by tests', type: 'mixed', starter: 'markdown' });
    expect(res.status).toBe(201);
    projectId = res.body.project.id;
    expect(res.body.project.status).toBe('draft');
    expect(res.body.project.ownerId).toBe(student.user.id);
    expect(res.body.project.documents.length).toBeGreaterThanOrEqual(1);
    const list = await api().get('/api/projects').set('Cookie', student.cookie);
    expect(list.body.projects.map((p: { id: string }) => p.id)).toContain(projectId);
  });

  it('validates project creation', async () => {
    const res = await api().post('/api/projects').set('Cookie', student.cookie).send({ title: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates, saves and reopens a markdown document (Hindi + Tamil text preserved)', async () => {
    const create = await api().post('/api/documents').set('Cookie', student.cookie).send({ projectId, title: 'भिन्न नोट्स', format: 'markdown', content: '# Heading\n\nHello **world**', language: 'hi' });
    expect(create.status).toBe(201);
    documentId = create.body.document.id;
    const content = '# भिन्न क्या है?\n\nபின்னம் என்பது ஒரு முழுப் பொருளின் சம பாகங்கள்.\n\n- point one\n- point two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n';
    const save = await api().put(`/api/documents/${documentId}`).set('Cookie', student.cookie).send({ content, title: 'Saved title' });
    expect(save.status).toBe(200);
    expect(save.body.document.content).toBe(content);
    const reopen = await api().get(`/api/documents/${documentId}`).set('Cookie', student.cookie);
    expect(reopen.status).toBe(200);
    expect(reopen.body.document.title).toBe('Saved title');
    expect(reopen.body.document.content).toBe(content);
    expect(reopen.body.document.projectId).toBe(projectId);
  });

  it('sanitises rich text HTML on save', async () => {
    const res = await api().post('/api/documents').set('Cookie', student.cookie).send({ projectId, title: 'Rich', format: 'richtext', content: '<p>ok</p><script>alert(1)</script><img src=x onerror="alert(1)">' });
    expect(res.status).toBe(201);
    expect(res.body.document.content).not.toMatch(/<script|onerror/);
    expect(res.body.document.content).toContain('<p>ok</p>');
  });

  it('exports a document to a real PDF with embedded Indic fonts', async () => {
    const res = await api().get(`/api/documents/${documentId}/export.pdf`).set('Cookie', student.cookie).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    const buf = res.body as Buffer;
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(2000);
    const text = buf.toString('latin1');
    expect(text).toMatch(/NotoSansDevanagari|Devanagari/);
    expect(text).toMatch(/NotoSansTamil|Tamil/);
    expect(text).toMatch(/%%EOF/);
  });

  it('creates, updates and reads a code file', async () => {
    const create = await api().post('/api/files').set('Cookie', student.cookie).send({ projectId, name: 'test.py', language: 'python' });
    expect(create.status).toBe(201);
    fileId = create.body.file.id;
    expect(create.body.file.content).toMatch(/print/);
    const update = await api().put(`/api/files/${fileId}`).set('Cookie', student.cookie).send({ content: 'print("hi")' });
    expect(update.status).toBe(200);
    const read = await api().get(`/api/files/${fileId}`).set('Cookie', student.cookie);
    expect(read.body.file.content).toBe('print("hi")');
    const badName = await api().post('/api/files').set('Cookie', student.cookie).send({ projectId, name: '../../etc/passwd', language: 'python' });
    expect(badName.status).toBe(400);
  });

  it('submits the project to a project assignment and the teacher sees it', async () => {
    const res = await api().post(`/api/projects/${projectId}/submit`).set('Cookie', student.cookie).send({ assignmentId: 'asg_light_project', note: 'Done!' });
    expect(res.status).toBe(200);
    expect(res.body.project.status).toBe('submitted');
    const teacher = await loginAs('teacher');
    const detail = await api().get('/api/assignments/asg_light_project').set('Cookie', teacher.cookie);
    expect(detail.status).toBe(200);
    const mine = detail.body.submissions.find((s: { studentId: string }) => s.studentId === student.user.id);
    expect(mine).toBeDefined();
    expect(mine.projectId).toBe(projectId);
    expect(mine.status).toBe('submitted');
    // teacher grades it
    const grade = await api().patch(`/api/submissions/${mine.id}/grade`).set('Cookie', teacher.cookie).send({ grade: 88, feedback: 'Great work' });
    expect(grade.status).toBe(200);
    expect(grade.body.submission.grade).toBe(88);
    expect(grade.body.submission.status).toBe('graded');
  });

  it('other students cannot read or modify my document', async () => {
    const other = await api().post('/api/auth/register').send({ name: 'Other', email: `other.${Date.now()}@example.com`, password: 'Str0ngPass!', role: 'student' });
    const cookie = String(other.headers['set-cookie']).split(';')[0];
    const read = await api().get(`/api/documents/${documentId}`).set('Cookie', cookie);
    expect(read.status).toBe(403);
    const write = await api().put(`/api/documents/${documentId}`).set('Cookie', cookie).send({ content: 'hacked' });
    expect(write.status).toBe(403);
    const pdf = await api().get(`/api/documents/${documentId}/export.pdf`).set('Cookie', cookie);
    expect(pdf.status).toBe(403);
  });

  it('deletes the project and cascades documents and files', async () => {
    const res = await api().delete(`/api/projects/${projectId}`).set('Cookie', student.cookie);
    expect(res.status).toBe(200);
    expect((await api().get(`/api/documents/${documentId}`).set('Cookie', student.cookie)).status).toBe(404);
    expect((await api().get(`/api/files/${fileId}`).set('Cookie', student.cookie)).status).toBe(404);
  });
});
