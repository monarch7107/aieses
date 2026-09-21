/**
 * PDF export: Markdown / rich text / plain text → PDF via pdfkit (pure JS).
 * Markdown → HTML (marked) → block model (htmlparser2) → pdfkit text runs.
 * Devanagari/Tamil text uses bundled Noto Sans fonts when available (see registerFonts).
 */
import PDFDocument from 'pdfkit';
import { marked } from 'marked';
import { Parser } from 'htmlparser2';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { DocumentFormat } from '@shared/types';

type Block =
  | { kind: 'heading'; level: number; runs: Run[] }
  | { kind: 'paragraph'; runs: Run[] }
  | { kind: 'list'; ordered: boolean; items: Run[][] }
  | { kind: 'code'; text: string }
  | { kind: 'quote'; runs: Run[] }
  | { kind: 'hr' }
  | { kind: 'table'; rows: string[][] };

interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

const require = createRequire(import.meta.url);

const fontFiles: { devanagari?: string; tamil?: string } = {};
let fontsResolved = false;
function resolveFonts() {
  if (fontsResolved) return;
  fontsResolved = true;
  const tryFind = (pkg: string, file: string) => {
    try {
      const pkgJson = require.resolve(`${pkg}/package.json`);
      const candidate = path.join(path.dirname(pkgJson), 'files', file);
      return fs.existsSync(candidate) ? candidate : undefined;
    } catch {
      return undefined;
    }
  };
  fontFiles.devanagari = tryFind('@fontsource/noto-sans-devanagari', 'noto-sans-devanagari-devanagari-400-normal.woff');
  fontFiles.tamil = tryFind('@fontsource/noto-sans-tamil', 'noto-sans-tamil-tamil-400-normal.woff');
}

export function pdfFontSupport(): { devanagari: boolean; tamil: boolean } {
  resolveFonts();
  return { devanagari: !!fontFiles.devanagari, tamil: !!fontFiles.tamil };
}

function scriptOf(ch: string): 'devanagari' | 'tamil' | 'latin' {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x0900 && code <= 0x097f) return 'devanagari';
  if (code >= 0x0b80 && code <= 0x0bff) return 'tamil';
  return 'latin';
}

/** Split text into script-homogeneous chunks so each can use a font that has the glyphs. */
function splitByScript(text: string): { text: string; script: 'devanagari' | 'tamil' | 'latin' }[] {
  const chunks: { text: string; script: 'devanagari' | 'tamil' | 'latin' }[] = [];
  let current: 'devanagari' | 'tamil' | 'latin' | null = null;
  let buf = '';
  for (const ch of text) {
    let s = scriptOf(ch);
    // Spaces/punctuation inherit the current script to avoid font thrashing.
    if (s === 'latin' && current && current !== 'latin' && /[\s\p{P}\d]/u.test(ch)) s = current;
    if (current === null) current = s;
    if (s !== current) {
      chunks.push({ text: buf, script: current });
      buf = '';
      current = s;
    }
    buf += ch;
  }
  if (buf) chunks.push({ text: buf, script: current ?? 'latin' });
  return chunks;
}

function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  let runStyle = { bold: 0, italic: 0, code: 0 };
  let listStack: { ordered: boolean; items: Run[][] }[] = [];
  let tableRows: string[][] | null = null;
  let cell: string | null = null;
  let inPre = false;
  let preText = '';

  const pushRun = (text: string) => {
    if (!text) return;
    const run: Run = { text, bold: runStyle.bold > 0, italic: runStyle.italic > 0, code: runStyle.code > 0 };
    if (listStack.length) {
      const list = listStack[listStack.length - 1];
      if (!list.items.length) list.items.push([]);
      list.items[list.items.length - 1].push(run);
      return;
    }
    if (!current) current = { kind: 'paragraph', runs: [] };
    if (current.kind === 'paragraph' || current.kind === 'heading' || current.kind === 'quote') current.runs.push(run);
  };
  const flush = () => {
    if (current) {
      blocks.push(current);
      current = null;
    }
  };

  const parser = new Parser(
    {
      onopentag(name) {
        if (inPre) return;
        switch (name) {
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
            flush();
            current = { kind: 'heading', level: Number(name[1]), runs: [] };
            break;
          case 'p':
            flush();
            current = { kind: 'paragraph', runs: [] };
            break;
          case 'blockquote':
            flush();
            current = { kind: 'quote', runs: [] };
            break;
          case 'ul':
          case 'ol':
            flush();
            listStack.push({ ordered: name === 'ol', items: [] });
            break;
          case 'li':
            if (listStack.length) listStack[listStack.length - 1].items.push([]);
            break;
          case 'pre':
            flush();
            inPre = true;
            preText = '';
            break;
          case 'code':
            runStyle.code++;
            break;
          case 'strong':
          case 'b':
            runStyle.bold++;
            break;
          case 'em':
          case 'i':
            runStyle.italic++;
            break;
          case 'br':
            pushRun('\n');
            break;
          case 'hr':
            flush();
            blocks.push({ kind: 'hr' });
            break;
          case 'table':
            flush();
            tableRows = [];
            break;
          case 'tr':
            if (tableRows) tableRows.push([]);
            break;
          case 'td':
          case 'th':
            cell = '';
            break;
          case 'div':
            flush();
            current = { kind: 'paragraph', runs: [] };
            break;
          default:
            break;
        }
      },
      ontext(text) {
        if (inPre) {
          preText += text;
          return;
        }
        if (cell !== null) {
          cell += text;
          return;
        }
        const clean = text.replace(/\s+/g, ' ');
        if (clean.trim() === '' && !current && !listStack.length) return;
        pushRun(clean);
      },
      onclosetag(name) {
        if (name === 'pre') {
          inPre = false;
          blocks.push({ kind: 'code', text: preText.replace(/\n$/, '') });
          return;
        }
        if (inPre) return;
        switch (name) {
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'p':
          case 'blockquote':
          case 'div':
            flush();
            break;
          case 'ul':
          case 'ol': {
            const list = listStack.pop();
            if (list) blocks.push({ kind: 'list', ordered: list.ordered, items: list.items.filter((i) => i.length) });
            break;
          }
          case 'code':
            runStyle.code = Math.max(0, runStyle.code - 1);
            break;
          case 'strong':
          case 'b':
            runStyle.bold = Math.max(0, runStyle.bold - 1);
            break;
          case 'em':
          case 'i':
            runStyle.italic = Math.max(0, runStyle.italic - 1);
            break;
          case 'td':
          case 'th':
            if (tableRows && cell !== null) tableRows[tableRows.length - 1]?.push(cell.trim());
            cell = null;
            break;
          case 'table':
            if (tableRows) blocks.push({ kind: 'table', rows: tableRows });
            tableRows = null;
            break;
          default:
            break;
        }
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  flush();
  return blocks;
}

export interface PdfOptions {
  title: string;
  author: string;
  subtitle?: string;
  format: DocumentFormat;
  content: string;
}

export function renderDocumentPdf(opts: PdfOptions): Promise<Buffer> {
  resolveFonts();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true, info: { Title: opts.title, Author: opts.author, Creator: 'AIESES' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (fontFiles.devanagari) doc.registerFont('Devanagari', fontFiles.devanagari);
    if (fontFiles.tamil) doc.registerFont('Tamil', fontFiles.tamil);

    const fontFor = (script: 'devanagari' | 'tamil' | 'latin', bold: boolean, italic: boolean, code: boolean): string => {
      if (script === 'devanagari' && fontFiles.devanagari) return 'Devanagari';
      if (script === 'tamil' && fontFiles.tamil) return 'Tamil';
      if (code) return 'Courier';
      if (bold && italic) return 'Helvetica-BoldOblique';
      if (bold) return 'Helvetica-Bold';
      if (italic) return 'Helvetica-Oblique';
      return 'Helvetica';
    };

    const writeRuns = (runs: Run[], size: number, opt: { bold?: boolean; indent?: number; color?: string } = {}) => {
      const width = doc.page.width - doc.page.margins.left - doc.page.margins.right - (opt.indent ?? 0);
      const x = doc.page.margins.left + (opt.indent ?? 0);
      const pieces: { text: string; font: string }[] = [];
      for (const run of runs) {
        for (const chunk of splitByScript(run.text)) {
          pieces.push({ text: chunk.text, font: fontFor(chunk.script, !!(run.bold || opt.bold), !!run.italic, !!run.code) });
        }
      }
      if (!pieces.length) return;
      doc.fillColor(opt.color ?? '#111827').fontSize(size);
      pieces.forEach((p, i) => {
        doc.font(p.font).text(p.text, i === 0 ? x : undefined, undefined, { width, continued: i < pieces.length - 1, lineGap: 2 });
      });
    };

    // Header band
    doc.rect(0, 0, doc.page.width, 6).fill('#2563eb');
    doc.moveDown(0.5);
    writeRuns([{ text: opts.title, bold: true }], 22);
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text(`${opts.subtitle ? opts.subtitle + ' · ' : ''}${opts.author} · ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })} · Generated by AIESES`);
    doc.moveDown(0.6);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.8);

    let blocks: Block[];
    if (opts.format === 'text') {
      blocks = opts.content.split(/\n{2,}/).map((p) => ({ kind: 'paragraph', runs: [{ text: p }] }) as Block);
    } else {
      const html = opts.format === 'markdown' ? (marked.parse(opts.content, { async: false }) as string) : opts.content;
      blocks = htmlToBlocks(html);
    }

    for (const block of blocks) {
      switch (block.kind) {
        case 'heading': {
          doc.moveDown(block.level === 1 ? 0.6 : 0.4);
          writeRuns(block.runs, block.level === 1 ? 18 : block.level === 2 ? 15 : 13, { bold: true, color: '#1e3a8a' });
          doc.moveDown(0.3);
          break;
        }
        case 'paragraph':
          writeRuns(block.runs, 11);
          doc.moveDown(0.6);
          break;
        case 'quote':
          writeRuns(block.runs.map((r) => ({ ...r, italic: true })), 11, { indent: 16, color: '#374151' });
          doc.moveDown(0.6);
          break;
        case 'list':
          block.items.forEach((item, i) => {
            const marker = block.ordered ? `${i + 1}. ` : '• ';
            writeRuns([{ text: marker }, ...item], 11, { indent: 14 });
          });
          doc.moveDown(0.6);
          break;
        case 'code': {
          const startY = doc.y;
          const text = block.text;
          const height = doc.font('Courier').fontSize(9.5).heightOfString(text, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 16 }) + 12;
          if (startY + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
          const y = doc.y;
          doc.rect(doc.page.margins.left, y, doc.page.width - doc.page.margins.left - doc.page.margins.right, height).fill('#f3f4f6');
          doc.fillColor('#111827').font('Courier').fontSize(9.5).text(text, doc.page.margins.left + 8, y + 6, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 16 });
          doc.y = y + height;
          doc.moveDown(0.6);
          break;
        }
        case 'hr':
          doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#e5e7eb').stroke();
          doc.moveDown(0.6);
          break;
        case 'table': {
          const cols = Math.max(...block.rows.map((r) => r.length), 1);
          const width = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / cols;
          block.rows.forEach((row, ri) => {
            const y = doc.y;
            let rowHeight = 0;
            row.forEach((cellText, ci) => {
              const font = ri === 0 ? 'Helvetica-Bold' : 'Helvetica';
              const h = doc.font(font).fontSize(10).heightOfString(cellText, { width: width - 8 });
              rowHeight = Math.max(rowHeight, h);
              doc.fillColor('#111827').text(cellText, doc.page.margins.left + ci * width + 4, y + 3, { width: width - 8 });
            });
            doc.y = y + rowHeight + 6;
            doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#e5e7eb').stroke();
            doc.y += 2;
          });
          doc.moveDown(0.6);
          break;
        }
      }
    }

    // Footer on every page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#9ca3af').text(`AIESES · ${opts.title} · page ${i + 1} of ${range.count}`, doc.page.margins.left, doc.page.height - 40, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'center',
      });
    }
    doc.end();
  });
}
