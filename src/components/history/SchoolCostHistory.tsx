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
import type { SchoolHistory } from '@/lib/data/history';

// Validated pair (dataviz validator, light surface): accent blue + amber
const COA_COLOR = '#2563EB';
const NET_COLOR = '#D97706';

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`;
const fmtCompact = (v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${v}`);

export default function SchoolCostHistory({ history }: { history: SchoolHistory }) {
  const [real, setReal] = useState(true);
  const [showTable, setShowTable] = useState(false);

  const data = useMemo(
    () =>
      history.years.map((year, i) => ({
        year,
        coa: real ? history.coaReal[i] : history.coa[i],
        net: real ? history.netReal[i] : history.net[i],
      })),
    [history, real],
  );
  const hasCost = data.some((d) => d.coa != null || d.net != null);
  const first = data.find((d) => d.coa != null);
  const last = [...data].reverse().find((d) => d.coa != null);
  const change =
    first?.coa && last?.coa && first !== last
      ? Math.round(((last.coa - first.coa) / first.coa) * 100)
      : null;

  return (
    <section className="mt-10 rounded-lg border border-gray-200 bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-text-primary">Cost over time</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Cost of attendance and average net price (after grants), {history.years[0]} to{' '}
        {history.years[history.years.length - 1]}
        {change != null && first && last && (
          <>
            {' '}· cost of attendance {change >= 0 ? 'up' : 'down'} {Math.abs(change)}%
            {real ? ' after inflation' : ''} since {first.year}
          </>
        )}
        .
      </p>

      {hasCost ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-gray-200 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setReal(true)}
                className={`rounded px-2.5 py-1 ${real ? 'bg-text-primary text-white' : 'text-text-secondary'}`}
              >
                Inflation-adjusted ({history.realDollarsOf} $)
              </button>
              <button
                type="button"
                onClick={() => setReal(false)}
                className={`rounded px-2.5 py-1 ${!real ? 'bg-text-primary text-white' : 'text-text-secondary'}`}
              >
                As charged
              </button>
            </div>
          </div>

          <div className="mt-3 h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={(y: string) => `'${y.slice(2, 4)}`}
                  interval="preserveStartEnd"
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
                  labelFormatter={(y) => `Academic year ${String(y)}`}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="linear"
                  dataKey="coa"
                  name="Cost of attendance"
                  stroke={COA_COLOR}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="net"
                  name="Average net price"
                  stroke={NET_COLOR}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

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
                    <th className="py-1 pr-4 font-medium">Cost of attendance</th>
                    <th className="py-1 font-medium">Avg net price</th>
                  </tr>
                </thead>
                <tbody className="text-text-primary">
                  {data.map((d) => (
                    <tr key={d.year} className="border-t border-gray-100">
                      <td className="py-1 pr-4">{d.year}</td>
                      <td className="py-1 pr-4">{fmt(d.coa)}</td>
                      <td className="py-1">{fmt(d.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-text-secondary">No cost history reported for this school.</p>
      )}

      {history.earnings.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-text-primary">Graduate earnings by cohort</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Bachelor&rsquo;s graduates who received federal aid, working and not enrolled;
            graduate-weighted across programs. The Department of Education has published
            comparable figures for only these cohorts, so read them as checkpoints, not a trend.
            Dollars as published (not inflation-adjusted).
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-secondary">
                  <th className="py-1.5 pr-4 font-medium">Graduating cohort</th>
                  <th className="py-1.5 pr-4 font-medium">7 years out</th>
                  <th className="py-1.5 pr-4 font-medium">5 years out</th>
                  <th className="py-1.5 font-medium">1 year out</th>
                </tr>
              </thead>
              <tbody className="text-text-primary">
                {history.earnings.map((e) => (
                  <tr key={e.label} className="border-t border-gray-100">
                    <td className="py-1.5 pr-4">{e.label}</td>
                    <td className="py-1.5 pr-4">{fmt(e.e7)}</td>
                    <td className="py-1.5 pr-4">{fmt(e.e5)}</td>
                    <td className="py-1.5">{fmt(e.e1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] text-text-secondary">
        Source: U.S. Department of Education College Scorecard (historical data files).
        Inflation adjustment uses CPI-U. A one-year jump or dip can reflect how a school
        reported that year (for example, remote-instruction years without room and board).
      </p>
    </section>
  );
}
