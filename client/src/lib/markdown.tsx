import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { cn } from './utils';

marked.setOptions({ gfm: true, breaks: false });

// Open external links safely in a new tab.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function renderMarkdown(md: string): string {
  const html = marked.parse(md ?? '', { async: false }) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html ?? '', { USE_PROFILES: { html: true } });
}

export function Markdown({ content, className, compact }: { content: string; className?: string; compact?: boolean }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return <div className={cn('prose-aieses', compact && 'prose-compact', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function SafeHtml({ html, className }: { html: string; className?: string }) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);
  return <div className={cn('prose-aieses', className)} dangerouslySetInnerHTML={{ __html: clean }} />;
}
