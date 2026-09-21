import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', opts);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(iso);
}

export function dueLabel(iso: string | null | undefined): { text: string; tone: 'ok' | 'warn' | 'late' } {
  if (!iso) return { text: 'No due date', tone: 'ok' };
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return { text: `Overdue by ${Math.abs(days)} d`, tone: 'late' };
  if (days === 0) return { text: 'Due today', tone: 'warn' };
  if (days <= 2) return { text: `Due in ${days} d`, tone: 'warn' };
  return { text: `Due ${formatDate(iso)}`, tone: 'ok' };
}

export function masteryTone(mastery: number): { bar: string; text: string; bg: string; label: string } {
  if (mastery < 60) return { bar: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', label: 'Weak' };
  if (mastery < 80) return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', label: 'Developing' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Strong' };
}

export function scoreTone(percent: number): string {
  if (percent < 40) return 'text-rose-700 bg-rose-50 ring-rose-200';
  if (percent < 60) return 'text-amber-700 bg-amber-50 ring-amber-200';
  if (percent < 80) return 'text-sky-700 bg-sky-50 ring-sky-200';
  return 'text-emerald-700 bg-emerald-50 ring-emerald-200';
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
