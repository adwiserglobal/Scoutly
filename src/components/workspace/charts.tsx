import { useMemo, useState } from 'react';

export const CHART_COLORS = {
  orange: '#FF5A12',
  blue: '#5B9DFF',
  green: '#3DD68C',
  violet: '#A78BFA',
  amber: '#F5B544',
  grid: 'rgba(255,255,255,0.06)',
  text: '#78716c',
};

export interface AreaSeries {
  key: string;
  label: string;
  color: string;
}

function niceMax(value: number) {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const norm = value / pow;
  const step = norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * pow;
}

function shortDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** Multi-series line/area chart with hover tooltip. */
export function ActivityChart({
  data,
  series,
  height = 220,
}: {
  data: Array<Record<string, number | string>>;
  series: AreaSeries[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const width = 720;
  const pad = { l: 34, r: 10, t: 12, b: 24 };
  const active = series.filter((s) => !off[s.key]);
  const max = niceMax(Math.max(1, ...data.flatMap((d) => active.map((s) => Number(d[s.key]) || 0))));
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;

  const paths = useMemo(
    () =>
      active.map((s) => {
        const pts = data.map((d, i) => [x(i), y(Number(d[s.key]) || 0)] as const);
        const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
        const area = `${line} L${pts[pts.length - 1]?.[0] ?? 0},${pad.t + innerH} L${pts[0]?.[0] ?? 0},${pad.t + innerH} Z`;
        return { s, line, area };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, off, max]
  );

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));
  const hoverRow = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {series.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setOff((o) => ({ ...o, [s.key]: !o[s.key] }))}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
              off[s.key] ? 'border-white/[0.06] text-stone-600' : 'border-white/[0.10] text-stone-300'
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: off[s.key] ? '#44403c' : s.color }} />
            {s.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * width;
            const idx = Math.round(((px - pad.l) / innerW) * (data.length - 1));
            setHover(Math.min(data.length - 1, Math.max(0, idx)));
          }}
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`ag-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={CHART_COLORS.grid} />
              <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill={CHART_COLORS.text}>{t}</text>
            </g>
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={x(i)} y={height - 7} textAnchor="middle" fontSize="9" fill={CHART_COLORS.text}>
                {shortDate(String(d.date))}
              </text>
            ) : null
          )}
          {paths.map(({ s, area }) => <path key={`a-${s.key}`} d={area} fill={`url(#ag-${s.key})`} />)}
          {paths.map(({ s, line }) => (
            <path key={`l-${s.key}`} d={line} fill="none" stroke={s.color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + innerH} stroke="rgba(255,255,255,0.18)" />
              {active.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(Number(data[hover][s.key]) || 0)} r="3.5" fill={s.color} stroke="#111418" strokeWidth="1.5" />
              ))}
            </g>
          )}
        </svg>
        {hoverRow && hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[120px] rounded-lg border border-white/[0.10] bg-[#0c0f13]/95 px-2.5 py-2 text-[10px] shadow-xl"
            style={{ left: `${Math.min(78, Math.max(2, (x(hover) / width) * 100 - 8))}%` }}
          >
            <div className="mb-1 font-semibold text-stone-200">{shortDate(String(hoverRow.date))}</div>
            {active.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 text-stone-400">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
                <span className="font-semibold tabular-nums text-white">{Number(hoverRow[s.key]) || 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Horizontal bars with optional secondary (highlight) value. */
export function BarList({
  items,
  color = CHART_COLORS.orange,
  empty = 'Sem dados no período.',
  format = (v: number) => String(v),
}: {
  items: Array<{ label: string; value: number; sub?: string }>;
  color?: string;
  empty?: string;
  format?: (value: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-6 text-center text-[11px] text-stone-600">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
            <span className="min-w-0 truncate text-stone-300">{item.label}</span>
            <span className="shrink-0 tabular-nums text-stone-400">
              {item.sub && <span className="mr-2 text-stone-600">{item.sub}</span>}
              <span className="font-semibold text-white">{format(item.value)}</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(item.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Funnel with conversion between stages. */
export function Funnel({ stages }: { stages: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <ul className="space-y-2">
      {stages.map((stage, i) => {
        const prev = i > 0 ? stages[i - 1].value : null;
        const conv = prev && prev > 0 ? Math.round((stage.value / prev) * 100) : null;
        return (
          <li key={stage.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[11px] text-stone-400">{stage.label}</span>
            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-white/[0.04]">
              <div
                className="flex h-full items-center rounded-md px-2 transition-all duration-500"
                style={{ width: `${Math.max(stage.value ? 6 : 0, (stage.value / max) * 100)}%`, background: stage.color }}
              >
                <span className="text-[11px] font-semibold text-black/80 tabular-nums">{stage.value}</span>
              </div>
            </div>
            <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-stone-600">{conv !== null ? `${conv}%` : ''}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function WeekdayBars({ values }: { values: number[] }) {
  const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-2">
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="text-[9px] tabular-nums text-stone-500">{v || ''}</span>
          <div className="flex h-[72px] w-full items-end">
            <div
              className="w-full rounded-t-md transition-all duration-500"
              style={{ height: Math.max(v ? 4 : 2, (v / max) * 72), background: v === max && v > 0 ? CHART_COLORS.orange : 'rgba(255,255,255,0.10)' }}
            />
          </div>
          <span className="text-[10px] text-stone-500">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values, color = CHART_COLORS.orange }: { values: number[]; color?: string }) {
  const w = 80;
  const h = 26;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Progress ring used for usage limits. */
export function Ring({ value, size = 44, color = CHART_COLORS.orange }: { value: number; size?: number; color?: string }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value));
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={pct > 0.9 ? '#F87171' : color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        style={{ transition: 'stroke-dasharray .6s ease' }}
      />
    </svg>
  );
}
