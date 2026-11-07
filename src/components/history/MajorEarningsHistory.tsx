'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AgeBand, MajorHistory } from '@/lib/data/history';

// Validated pair (dataviz validator, light surface): accent blue + amber
const MAJOR_COLOR = '#2563EB';
const ALL_COLOR = '#D97706';

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`;
const fmtCompact = (v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${v}`);

const BANDS: { key: AgeBand; label: string }[] = [
  { key: '25-34', label: 'Ages 25–34' },
  { key: '35-44', label: 'Ages 35–44' },
];

export default function MajorEarningsHistory({ history }: { history: MajorHistory }) {
  const [band, setBand] = useState<AgeBand>('25-34');
  const [real, setReal] = useState(true);
  const [fieldIdx, setFieldIdx] = useState(0);
  const [showTable, setShowTable] = useState(false);
  const field = history.fields[Math.min(fieldIdx, history.fields.length - 1)];

  const data = useMemo(() => {
    const own = new Map((field.series[band] ?? []).map((p) => [p.year, p]));
    const all = new Map((history.overall[band] ?? []).map((p) => [p.year, p]));
    const known = [...new Set([...own.keys(), ...all.keys()])];
    // Every year in range, so missing years (2020) break the line instead of bridging it
    const years: number[] = [];
    for (let y = Math.min(...known); y <= Math.max(...known); y++) years.push(y);
    return years.map((year) => {
      const o = own.get(year);
      const a = all.get(year);
      return {
        year,
        major: o ? (real ? o.medianReal : o.median) : null,
        all: a ? (real ? a.medianReal : a.median) : null,
        n: o?.n ?? null,
      };
    });
  }, [field, band, history.overall, real]);

  const pts = data.filter((d) => d.major != null);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const change =
    first && last && first !== last
      ? Math.round(((last.major! - first.major!) / first.major!) * 100)
      : null;

  return (
    <section className="mt-10 rounded-lg border border-gray-200 bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-text-primary">Earnings over time</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Median wages of full-time, year-round workers whose highest degree is a bachelor&rsquo;s
        in this field, nationwide
        {change != null && (
          <>
            {' '}· {change >= 0 ? 'up' : 'down'} {Math.abs(change)}%
            {real ? ' after inflation' : ''} from {first.year} to {last.year}
          </>
        )}
        .
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {history.fields.length > 1 && (
          <select
            value={fieldIdx}
            onChange={(e) => setFieldIdx(Number(e.target.value))}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-text-primary"
            aria-label="Census field of degree"
          >
            {history.fields.map((f, i) => (
              <option key={f.fod1p} value={i}>
                {f.title}
              </option>
            ))}
          </select>
        )}
        <div className="inline-flex rounded-md border border-gray-200 p-0.5 text-xs">
          {BANDS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBand(b.key)}
              className={`rounded px-2.5 py-1 ${band === b.key ? 'bg-text-primary text-white' : 'text-text-secondary'}`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-md border border-gray-200 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setReal(true)}
            className={`rounded px-2.5 py-1 ${real ? 'bg-text-primary text-white' : 'text-text-secondary'}`}
          >
            {history.cpiBaseYear} dollars
          </button>
          <button
            type="button"
            onClick={() => setReal(false)}
            className={`rounded px-2.5 py-1 ${!real ? 'bg-text-primary text-white' : 'text-text-secondary'}`}
          >
            As reported
          </button>
        </div>
      </div>

      {pts.length > 0 ? (
        <div className="mt-3 h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="year"
                type="number"
                domain={['dataMin', 'dataMax']}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(y: number) => String(y)}
                allowDecimals={false}
                minTickGap={16}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={fmtCompact}
                width={48}
                domain={[0, 'auto']}
              />
              <Tooltip
                formatter={(v?: number, name?: string) => [fmt(v), name ?? ""]}
                labelFormatter={(y) => (Number(y) === 2020 ? '2020 (not released)' : String(y))}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="linear"
                dataKey="major"
                name={field.title}
                stroke={MAJOR_COLOR}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="all"
                name="All bachelor's degrees"
                stroke={ALL_COLOR}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-3 text-sm text-text-secondary">
          Not enough survey responses for this age group.
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowTable((s) => !s)}
        className="mt-2 text-xs text-accent hover:underline"
      >
        {showTable ? 'Hide' : 'Show'} table
      </button>
      {showTable && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-1 pr-4 font-medium">Year</th>
                <th className="py-1 pr-4 font-medium">{field.title}</th>
                <th className="py-1 font-medium">All bachelor&rsquo;s</th>
              </tr>
            </thead>
            <tbody className="text-text-primary">
              {data.map((d) => (
                <tr key={d.year} className="border-t border-gray-100">
                  <td className="py-1 pr-4">{d.year}</td>
                  <td className="py-1 pr-4">{fmt(d.major)}</td>
                  <td className="py-1">{fmt(d.all)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[11px] text-text-secondary">
        Source: U.S. Census Bureau, American Community Survey 1-year microdata (no 2020
        release). Fields of degree are Census categories matched to this major; years with
        too few survey responses are omitted.
        {real ? ` Inflation-adjusted with CPI-U to ${history.cpiBaseYear} dollars.` : ''}
      </p>
    </section>
  );
}
