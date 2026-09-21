import { cn, masteryTone } from '@/lib/utils';

/** Simple accessible SVG bar chart (no external chart library). */
export function BarChart({ data, height = 140, color = '#2563eb', valueSuffix = '', className }: { data: { label: string; value: number; color?: string }[]; height?: number; color?: string; valueSuffix?: string; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / Math.max(data.length, 1);
  return (
    <figure className={cn('w-full', className)}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label={`Bar chart: ${data.map((d) => `${d.label} ${d.value}${valueSuffix}`).join(', ')}`}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 24);
          return (
            <g key={d.label}>
              <rect x={i * barW + barW * 0.15} y={height - 18 - h} width={barW * 0.7} height={h} rx={1.5} fill={d.color ?? color} />
              <text x={i * barW + barW / 2} y={height - 18 - h - 3} fontSize="5" textAnchor="middle" fill="#334155">
                {d.value}
                {valueSuffix}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="grid text-center text-[11px] text-slate-500" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((d) => (
          <span key={d.label} className="truncate px-0.5">
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Activity over the last N days (lessons + attempts). */
export function ActivityChart({ data, className }: { data: { date: string; lessons: number; attempts: number }[]; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.lessons + d.attempts));
  return (
    <div className={cn('w-full', className)}>
      <div className="flex h-28 items-end gap-1" role="img" aria-label={`Activity for the last ${data.length} days`}>
        {data.map((d) => {
          const total = d.lessons + d.attempts;
          const hL = (d.lessons / max) * 100;
          const hA = (d.attempts / max) * 100;
          return (
            <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.date}: ${d.lessons} lessons, ${d.attempts} attempts`}>
              <div className="w-full rounded-t-sm bg-brand-500" style={{ height: `${hA}%` }} />
              <div className="w-full rounded-t-sm bg-emerald-500" style={{ height: `${hL}%` }} />
              {total === 0 && <div className="h-0.5 w-full bg-slate-200" />}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{data[0]?.date.slice(5)}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> lessons
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-brand-500" /> attempts
          </span>
        </span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

/** Ring gauge for percentages. */
export function Ring({ value, size = 72, stroke = 8, label, tone }: { value: number; size?: number; stroke?: number; label?: string; tone?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const color = tone ?? (v < 60 ? '#e11d48' : v < 80 ? '#f59e0b' : '#10b981');
  return (
    <div className="inline-flex flex-col items-center" role="img" aria-label={`${label ?? 'value'} ${Math.round(v)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} strokeLinecap="round" />
      </svg>
      <span className="-mt-[calc(50%+0.6rem)] text-sm font-bold text-slate-800" style={{ marginTop: -(size / 2 + 9) }}>
        {Math.round(v)}%
      </span>
      <span className="mt-[calc(50%-0.6rem)] text-[11px] text-slate-500" style={{ marginTop: size / 2 - 10 }}>
        {label}
      </span>
    </div>
  );
}

/** Heatmap cell for skill mastery tables. */
export function MasteryCell({ value }: { value: number | null }) {
  if (value === null) return <span className="inline-block rounded px-2 py-0.5 text-xs text-slate-400">—</span>;
  const t = masteryTone(value);
  return <span className={cn('inline-block min-w-[3rem] rounded px-2 py-0.5 text-center text-xs font-semibold', t.bg, t.text)}>{Math.round(value)}%</span>;
}
