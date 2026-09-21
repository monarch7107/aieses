/**
 * Student creation workspace: projects, documents (markdown / text / rich text), code files, PDF export.
 */
import { Router } from 'express';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import { config } from '../config.js';
import { nowIso, q, tx } from '../db/index.js';
import { forbidden, notFound, tooLarge } from '../lib/errors.js';
import { newId, paramString, validate } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { renderDocumentPdf, pdfFontSupport } from '../services/pdf.js';
import { logActivity } from '../services/progress.js';
import type { CodeFile, CodeLanguage, Document, DocumentFormat, DocumentSummary, FileSummary, Project } from '@shared/types';

export const workspaceRouter = Router();
workspaceRouter.use(requireAuth);

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'hr'],
  allowedAttributes: { a: ['href', 'title'], span: ['style'], div: ['style'] },
  allowedStyles: { '*': { 'text-align': [/^left$/, /^right$/, /^center$/] } },
  allowedSchemes: ['http', 'https', 'mailto'],
};

export function sanitizeDocumentContent(format: DocumentFormat, content: string): string {
  return format === 'richtext' ? sanitizeHtml(content, SANITIZE) : content;
}

// ---- helpers -------------------------------------------------------------------
interface ProjectRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  type: Project['type'];
  class_id: string | null;
  assignment_id: string | null;
  status: Project['status'];
  created_at: string;
  updated_at: string;
}
const mapProject = (r: ProjectRow): Project => ({
  id: r.id,
  ownerId: r.owner_id,
  title: r.title,
  description: r.description,
  type: r.type,
  classId: r.class_id,
  assignmentId: r.assignment_id,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

interface DocRow {
  id: string;
  project_id: string;
  owner_id: string;
  title: string;
  format: DocumentFormat;
  content: string;
  language: Document['language'];
  created_at: string;
  updated_at: string;
}
const mapDocSummary = (r: DocRow): DocumentSummary => ({ id: r.id, projectId: r.project_id, ownerId: r.owner_id, title: r.title, format: r.format, createdAt: r.created_at, updatedAt: r.updated_at });
const mapDoc = (r: DocRow): Document => ({ ...mapDocSummary(r), content: r.content, language: r.language });

interface FileRow {
  id: string;
  project_id: string;
  owner_id: string;
  name: string;
  language: CodeLanguage;
  content: string;
  size: number;
  updated_at: string;
}
const mapFileSummary = (r: FileRow): FileSummary => ({ id: r.id, projectId: r.project_id, ownerId: r.owner_id, name: r.name, language: r.language, size: r.size, updatedAt: r.updated_at });
const mapFile = (r: FileRow): CodeFile => ({ ...mapFileSummary(r), content: r.content });

function loadProject(id: string): ProjectRow {
  const row = q.get<ProjectRow>('SELECT * FROM projects WHERE id = ?', id);
  if (!row) throw notFound('Project');
  return row;
}

/** Owner, or a teacher whose class the project was submitted to, or admin. */
function canReadProject(req: Parameters<typeof requireAuth>[0], project: ProjectRow): boolean {
  const s = req.session!;
  if (s.role === 'admin' || project.owner_id === s.sub) return true;
  if (s.role === 'teacher') {
    return !!q.get(
      `SELECT 1 FROM class_students cs JOIN classes c ON c.id = cs.class_id WHERE c.teacher_id = ? AND cs.student_id = ?`,
      s.sub,
      project.owner_id,
    );
  }
  return false;
}
function assertOwner(req: Parameters<typeof requireAuth>[0], ownerId: string) {
  if (req.session!.sub !== ownerId) throw forbidden('You do not own this item');
}
function touchProject(id: string) {
  q.run('UPDATE projects SET updated_at = ? WHERE id = ?', nowIso(), id);
}

const STARTERS: Record<CodeLanguage, string> = {
  javascript: `// JavaScript runs in your browser's Web Worker sandbox\nconst marks = [78, 92, 65, 88];\nconst total = marks.reduce((sum, m) => sum + m, 0);\nconsole.log("Total:", total);\nconsole.log("Average:", total / marks.length);\n`,
  python: `# Python runs in your browser via Pyodide (WebAssembly)\nmarks = [78, 92, 65, 88]\ntotal = sum(marks)\nprint("Total:", total)\nprint("Average:", total / len(marks))\n`,
  c: `#include <stdio.h>\n\nint main() {\n    int marks[] = {78, 92, 65, 88};\n    int total = 0;\n    for (int i = 0; i < 4; i++) total += marks[i];\n    printf("Total: %d\\n", total);\n    return 0;\n}\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        int[] marks = {78, 92, 65, 88};\n        int total = 0;\n        for (int m : marks) total += m;\n        System.out.println("Total: " + total);\n    }\n}\n`,
};
const EXT: Record<CodeLanguage, string> = { javascript: 'js', python: 'py', c: 'c', java: 'java' };

// ---- Projects ---------------------------------------------------------------------
workspaceRouter.get('/projects', (req, res) => {
  const s = req.session!;
  const rows =
    s.role === 'student'
      ? q.all<ProjectRow>('SELECT * FROM projects WHERE owner_id = ? ORDER BY updated_at DESC', s.sub)
      : s.role === 'admin'
        ? q.all<ProjectRow>('SELECT * FROM projects ORDER BY updated_at DESC LIMIT 100')
        : q.all<ProjectRow>(
            `SELECT DISTINCT p.* FROM projects p JOIN class_students cs ON cs.student_id = p.owner_id JOIN classes c ON c.id = cs.class_id WHERE c.teacher_id = ? AND p.status = 'submitted' ORDER BY p.updated_at DESC`,
            s.sub,
          );
  const projects = rows.map((r) => ({
    ...mapProject(r),
    documents: q.all<DocRow>('SELECT * FROM documents WHERE project_id = ? ORDER BY updated_at DESC', r.id).map(mapDocSummary),
    files: q.all<FileRow>('SELECT * FROM files WHERE project_id = ? ORDER BY name', r.id).map(mapFileSummary),
  }));
  res.json({ projects });
});

const projectSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(''),
  type: z.enum(['document', 'code', 'mixed']).default('mixed'),
  classId: z.string().max(100).nullable().optional(),
  assignmentId: z.string().max(100).nullable().optional(),
  starter: z.enum(['none', 'markdown', 'python', 'javascript']).default('none'),
});

workspaceRouter.post('/projects', requireRole('student'), (req, res) => {
  const body = validate(projectSchema, req.body, 'project');
  const s = req.session!;
  const id = newId('prj');
  const at = nowIso();
  tx(() => {
    if (body.classId && !q.get('SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?', body.classId, s.sub)) throw forbidden('You are not in that class');
    q.run(
      "INSERT INTO projects (id, owner_id, title, description, type, class_id, assignment_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
      id, s.sub, body.title, body.description, body.type, body.classId ?? null, body.assignmentId ?? null, at, at,
    );
    if (body.starter === 'markdown' || body.type === 'document') {
      q.run(
        "INSERT INTO documents (id, project_id, owner_id, title, format, content, language, created_at, updated_at) VALUES (?, ?, ?, ?, 'markdown', ?, 'en', ?, ?)",
        newId('doc'), id, s.sub, `${body.title} — Notes`, `# ${body.title}\n\nStart writing here. Use **bold**, lists and tables — then export to PDF.\n\n## Section 1\n\n- Point one\n- Point two\n`, at, at,
      );
    }
    if (body.starter === 'python' || body.starter === 'javascript') {
      const lang = body.starter;
      q.run(
        'INSERT INTO files (id, project_id, owner_id, name, language, content, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        newId('file'), id, s.sub, `main.${EXT[lang]}`, lang, STARTERS[lang], Buffer.byteLength(STARTERS[lang]), at, at,
      );
    }
  });
  logActivity(s.sub, 'project_created', id, at);
  res.status(201).json({ project: getProjectDetail(id) });
});

function getProjectDetail(id: string): Project {
  const row = loadProject(id);
  return {
    ...mapProject(row),
    documents: q.all<DocRow>('SELECT * FROM documents WHERE project_id = ? ORDER BY updated_at DESC', id).map(mapDocSummary),
    files: q.all<FileRow>('SELECT * FROM files WHERE project_id = ? ORDER BY name', id).map(mapFileSummary),
  };
}

workspaceRouter.get('/projects/:id', (req, res) => {
  const project = loadProject(paramString(req, 'id'));
  if (!canReadProject(req, project)) throw forbidden();
  res.json({ project: getProjectDetail(project.id) });
});

workspaceRouter.patch('/projects/:id', requireRole('student'), (req, res) => {
  const project = loadProject(paramString(req, 'id'));
  assertOwner(req, project.owner_id);
  const body = validate(projectSchema.partial().pick({ title: true, description: true, type: true }), req.body, 'project');
  if (body.title) q.run('UPDATE projects SET title = ? WHERE id = ?', body.title, project.id);
  if (body.description !== undefined) q.run('UPDATE projects SET description = ? WHERE id = ?', body.description, project.id);
  if (body.type) q.run('UPDATE projects SET type = ? WHERE id = ?', body.type, project.id);
  touchProject(project.id);
  res.json({ project: getProjectDetail(project.id) });
});

workspaceRouter.delete('/projects/:id', requireRole('student'), (req, res) => {
  const project = loadProject(paramString(req, 'id'));
  assertOwner(req, project.owner_id);
  q.run('DELETE FROM projects WHERE id = ?', project.id);
  res.json({ ok: true });
});

workspaceRouter.post('/projects/:id/submit', requireRole('student'), (req, res) => {
  const project = loadProject(paramString(req, 'id'));
  assertOwner(req, project.owner_id);
  const body = validate(z.object({ assignmentId: z.string().max(100).nullable().optional(), note: z.string().max(2000).default('') }), req.body, 'submission');
  const at = nowIso();
  const assignmentId = body.assignmentId ?? project.assignment_id;
  tx(() => {
    q.run("UPDATE projects SET status = 'submitted', assignment_id = COALESCE(?, assignment_id), updated_at = ? WHERE id = ?", assignmentId ?? null, at, project.id);
    if (assignmentId) {
      const a = q.get<{ class_id: string }>('SELECT class_id FROM assignments WHERE id = ?', assignmentId);
      if (!a) throw notFound('Assignment');
      if (!q.get('SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?', a.class_id, req.session!.sub)) throw forbidden('You are not enrolled in that class');
      q.run(
        `INSERT INTO submissions (id, assignment_id, student_id, project_id, attempt_id, content, status, grade, feedback, submitted_at)
         VALUES (?, ?, ?, ?, NULL, ?, 'submitted', NULL, NULL, ?)
         ON CONFLICT(assignment_id, student_id) DO UPDATE SET project_id = excluded.project_id, content = excluded.content, status = 'submitted', submitted_at = excluded.submitted_at`,
        newId('sub'), assignmentId, req.session!.sub, project.id, body.note, at,
      );
    }
    logActivity(req.session!.sub, 'project_submitted', project.id, at);
  });
  res.json({ project: getProjectDetail(project.id) });
});

// ---- Documents -------------------------------------------------------------------
const docCreateSchema = z.object({
  projectId: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(120),
  format: z.enum(['markdown', 'text', 'richtext']).default('markdown'),
  content: z.string().max(config.limits.maxDocumentBytes).default(''),
  language: z.enum(['en', 'hi', 'ta', 'unr']).default('en'),
});

workspaceRouter.post('/documents', requireRole('student'), (req, res) => {
  const body = validate(docCreateSchema, req.body, 'document');
  const project = loadProject(body.projectId);
  assertOwner(req, project.owner_id);
  const id = newId('doc');
  const at = nowIso();
  q.run(
    'INSERT INTO documents (id, project_id, owner_id, title, format, content, language, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, project.id, req.session!.sub, body.title, body.format, sanitizeDocumentContent(body.format, body.content), body.language, at, at,
  );
  touchProject(project.id);
  res.status(201).json({ document: mapDoc(q.get<DocRow>('SELECT * FROM documents WHERE id = ?', id)!) });
});

function loadDoc(req: Parameters<typeof requireAuth>[0], id: string, write = false): DocRow {
  const doc = q.get<DocRow>('SELECT * FROM documents WHERE id = ?', id);
  if (!doc) throw notFound('Document');
  const project = loadProject(doc.project_id);
  if (write) assertOwner(req, doc.owner_id);
  else if (!canReadProject(req, project)) throw forbidden();
  return doc;
}

workspaceRouter.get('/documents/:id', (req, res) => {
  res.json({ document: mapDoc(loadDoc(req, paramString(req, 'id'))) });
});

const docPatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  format: z.enum(['markdown', 'text', 'richtext']).optional(),
  content: z.string().max(config.limits.maxDocumentBytes).optional(),
  language: z.enum(['en', 'hi', 'ta', 'unr']).optional(),
});

workspaceRouter.put('/documents/:id', requireRole('student'), (req, res) => {
  const doc = loadDoc(req, paramString(req, 'id'), true);
  const body = validate(docPatchSchema, req.body, 'document');
  const format = body.format ?? doc.format;
  const content = body.content !== undefined ? sanitizeDocumentContent(format, body.content) : doc.content;
  if (Buffer.byteLength(content, 'utf8') > config.limits.maxDocumentBytes) throw tooLarge('Document exceeds the size limit');
  q.run('UPDATE documents SET title = ?, format = ?, content = ?, language = ?, updated_at = ? WHERE id = ?', body.title ?? doc.title, format, content, body.language ?? doc.language, nowIso(), doc.id);
  touchProject(doc.project_id);
  logActivity(req.session!.sub, 'document_saved', doc.id);
  res.json({ document: mapDoc(q.get<DocRow>('SELECT * FROM documents WHERE id = ?', doc.id)!) });
});

workspaceRouter.delete('/documents/:id', requireRole('student'), (req, res) => {
  const doc = loadDoc(req, paramString(req, 'id'), true);
  q.run('DELETE FROM documents WHERE id = ?', doc.id);
  touchProject(doc.project_id);
  res.json({ ok: true });
});

workspaceRouter.get('/documents/:id/export.pdf', async (req, res) => {
  const doc = loadDoc(req, paramString(req, 'id'));
  const owner = q.get<{ name: string }>('SELECT name FROM users WHERE id = ?', doc.owner_id);
  const project = loadProject(doc.project_id);
  const pdf = await renderDocumentPdf({ title: doc.title, author: owner?.name ?? 'Student', subtitle: project.title, format: doc.format, content: doc.content });
  if (req.session!.role === 'student') logActivity(req.session!.sub, 'pdf_export', doc.id);
  const safeName = doc.title.replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'document';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${safeName}.pdf"`);
  res.setHeader('Content-Length', String(pdf.length));
  res.send(pdf);
});

workspaceRouter.get('/pdf/capabilities', (_req, res) => res.json({ fonts: pdfFontSupport() }));

// ---- Code files -------------------------------------------------------------------
const fileCreateSchema = z.object({
  projectId: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(80).regex(/^[\w\-. ]+$/, 'must be a simple file name'),
  language: z.enum(['javascript', 'python', 'c', 'java']),
  content: z.string().max(config.limits.maxFileBytes).optional(),
});

workspaceRouter.post('/files', requireRole('student'), (req, res) => {
  const body = validate(fileCreateSchema, req.body, 'file');
  const project = loadProject(body.projectId);
  assertOwner(req, project.owner_id);
  if (q.get('SELECT 1 FROM files WHERE project_id = ? AND name = ?', project.id, body.name)) throw forbidden('A file with that name already exists in this project');
  const id = newId('file');
  const at = nowIso();
  const content = body.content ?? STARTERS[body.language];
  q.run(
    'INSERT INTO files (id, project_id, owner_id, name, language, content, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, project.id, req.session!.sub, body.name, body.language, content, Buffer.byteLength(content), at, at,
  );
  touchProject(project.id);
  res.status(201).json({ file: mapFile(q.get<FileRow>('SELECT * FROM files WHERE id = ?', id)!) });
});

function loadFile(req: Parameters<typeof requireAuth>[0], id: string, write = false): FileRow {
  const file = q.get<FileRow>('SELECT * FROM files WHERE id = ?', id);
  if (!file) throw notFound('File');
  const project = loadProject(file.project_id);
  if (write) assertOwner(req, file.owner_id);
  else if (!canReadProject(req, project)) throw forbidden();
  return file;
}

workspaceRouter.get('/files/:id', (req, res) => res.json({ file: mapFile(loadFile(req, paramString(req, 'id'))) }));

workspaceRouter.put('/files/:id', requireRole('student'), (req, res) => {
  const file = loadFile(req, paramString(req, 'id'), true);
  const body = validate(z.object({ content: z.string().max(config.limits.maxFileBytes).optional(), name: fileCreateSchema.shape.name.optional(), language: fileCreateSchema.shape.language.optional() }), req.body, 'file');
  const content = body.content ?? file.content;
  q.run('UPDATE files SET content = ?, name = ?, language = ?, size = ?, updated_at = ? WHERE id = ?', content, body.name ?? file.name, body.language ?? file.language, Buffer.byteLength(content), nowIso(), file.id);
  touchProject(file.project_id);
  res.json({ file: mapFile(q.get<FileRow>('SELECT * FROM files WHERE id = ?', file.id)!) });
});

workspaceRouter.delete('/files/:id', requireRole('student'), (req, res) => {
  const file = loadFile(req, paramString(req, 'id'), true);
  q.run('DELETE FROM files WHERE id = ?', file.id);
  touchProject(file.project_id);
  res.json({ ok: true });
});
