'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';
import type { SchoolRanking, SortDir } from '@/types';
import { formatCurrency, formatCompact, formatRate, formatNumber, formatPayback } from '@/lib/formatters';
import { getDisplayTier, TIER_COLORS, TIER_ORDER } from '@/lib/tiers';
import { trackEvent } from '@/lib/analytics';
import StatCard from './StatCard';

interface ScatterDatum {
  x: number;
  y: number;
  unitId: number;
  name: string;
  state: string;
  tier: string;
  admitRate: number;
  earnings: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterDatum }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-text-primary">{d.name}</p>
      <p className="text-xs text-text-secondary">{d.state}</p>
      <div className="mt-1.5 flex gap-4 text-xs">
        <span>5yr Avg: <strong className="text-earn-above">{formatCurrency(d.earnings)}</strong></span>
        <span>Admit: <strong>{formatRate(d.admitRate)}</strong></span>
      </div>
      <span
        className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: TIER_COLORS[d.tier] ?? '#9ca3af' }}
      >
        {d.tier}
      </span>
    </div>
  );
}

type SortField =
  | 'name'
  | 'weightedEarn1yr'
  | 'weightedEarn5yr'
  | 'paybackYears'
  | 'programCount'
  | 'admissionRate'
  | 'costAttendance';

const PAGE_SIZE = 25;

interface CollegeRankingsProps {
  schoolRankings: SchoolRanking[];
}

export default function CollegeRankings({
  schoolRankings,
}: CollegeRankingsProps) {
  const [sortField, setSortField] = useState<SortField>('weightedEarn5yr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<number | null>(null);
  const [stateFilter, setStateFilter] = useState('');
  const [minPrograms, setMinPrograms] = useState(5);
  const [page, setPage] = useState(1);
  const [compareSet, setCompareSet] = useState<Set<number>>(new Set());

  const states = useMemo(() => {
    const s = new Set(schoolRankings.map((r) => r.state).filter(Boolean));
    return Array.from(s).sort();
  }, [schoolRankings]);

  // Filter
  const filtered = useMemo(() => {
    let rows = schoolRankings.filter((r) => r.programCount >= minPrograms);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (ownershipFilter != null) {
      rows = rows.filter((r) => r.ownership === ownershipFilter);
    }
    if (stateFilter) {
      rows = rows.filter((r) => r.state === stateFilter);
    }
    return rows;
  }, [schoolRankings, searchQuery, ownershipFilter, stateFilter, minPrograms]);

  // Sort
  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc'
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return rows;
  }, [filtered, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const handleSort = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' || field === 'paybackYears' ? 'asc' : 'desc');
    }
    setPage(1);
  }, [sortField]);

  const sortArrow = (field: SortField) => {
    if (sortField !== field) return ' \u21D5';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  // Stats
  const stats = useMemo(() => {
    const withEarn = filtered.filter((r) => r.weightedEarn5yr != null);
    const highest = withEarn.length
      ? withEarn.reduce((best, r) =>
          (r.weightedEarn5yr ?? 0) > (best.weightedEarn5yr ?? 0) ? r : best,
          withEarn[0],
        )
      : null;
    const withPayback = filtered.filter((r) => r.paybackYears != null);
    const fastestPayback = withPayback.length
      ? withPayback.reduce((best, r) =>
          (r.paybackYears ?? Infinity) < (best.paybackYears ?? Infinity) ? r : best,
          withPayback[0],
        )
      : null;
    return { total: filtered.length, highest, fastestPayback };
  }, [filtered]);

  // Comparison
  const comparedSchools = useMemo(() => {
    if (compareSet.size === 0) return [];
    return filtered.filter((r) => compareSet.has(r.unitId));
  }, [filtered, compareSet]);

  const handleCompareToggle = useCallback((unitId: number) => {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else if (next.size < 4) {
        next.add(unitId);
      }
      return next;
    });
  }, []);

  // Scatter chart data
  const { tierData, xDomain, yDomain } = useMemo(() => {
    const groups: Record<string, ScatterDatum[]> = {};
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const r of filtered) {
      if (r.admissionRate == null || r.weightedEarn5yr == null) continue;
      const tier = getDisplayTier(r.name, r.selectivityTier);
      if (!groups[tier]) groups[tier] = [];
      groups[tier].push({
        x: r.admissionRate,
        y: r.weightedEarn5yr,
        unitId: r.unitId,
        name: r.name,
        state: r.state,
        tier,
        admitRate: r.admissionRate,
        earnings: r.weightedEarn5yr,
      });
      if (r.admissionRate < minX) minX = r.admissionRate;
      if (r.admissionRate > maxX) maxX = r.admissionRate;
      if (r.weightedEarn5yr < minY) minY = r.weightedEarn5yr;
      if (r.weightedEarn5yr > maxY) maxY = r.weightedEarn5yr;
    }
    const xPad = (maxX - minX) * 0.05 || 0.05;
    const yPad = (maxY - minY) * 0.1 || 5000;
    return {
      tierData: groups,
      xDomain: [Math.max(0, minX - xPad), Math.min(1, maxX + xPad)] as [number, number],
      yDomain: [Math.max(0, minY - yPad), maxY + yPad] as [number, number],
    };
  }, [filtered]);

  const handleDotClick = useCallback((data: any) => {
    const uid = data?.unitId ?? data?.payload?.unitId;
    if (uid != null) {
      trackEvent('school_click', { unitId: uid });
      window.location.href = `/schools/${uid}?from=colleges`;
    }
  }, []);

  const filtersActive = !!(
    searchQuery ||
    ownershipFilter != null ||
    stateFilter
  );

  return (
    <div className="mt-6">
      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total Colleges" value={formatNumber(stats.total)} />
        <StatCard
          label="Highest Earning College"
          value={
            stats.highest
              ? formatCurrency(stats.highest.weightedEarn5yr)
              : '\u2014'
          }
          detail={stats.highest?.name}
        />
        <StatCard
          label="Fastest Payback"
          value={formatPayback(stats.fastestPayback?.paybackYears ?? null)}
          detail={stats.fastestPayback?.name}
        />
      </div>

      {/* Scatter chart */}
      <div
        className="mb-6 rounded-lg border border-gray-100 bg-white p-2 shadow-sm sm:p-4"
        style={{ userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest?.('svg')) e.preventDefault();
        }}
      >
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="x"
              type="number"
              domain={xDomain}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              label={{ value: 'Admission Rate', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={yDomain}
              tickFormatter={(v: number) => formatCompact(v)}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              width={60}
              label={{ value: 'Avg 5yr Earnings', angle: -90, position: 'insideLeft', offset: 5, fontSize: 12, fill: '#6b7280' }}
            />
            <Tooltip content={<ChartTooltip />} cursor={false} />
            {TIER_ORDER.map(
              (tier) =>
                tierData[tier] && (
                  <Scatter
                    key={tier}
                    name={tier}
                    data={tierData[tier]}
                    fill={TIER_COLORS[tier]}
                    onClick={handleDotClick}
                  />
                ),
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Comparison panel */}
      {comparedSchools.length >= 2 && (
        <div className="mb-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Comparing {comparedSchools.length} Schools
            </h3>
            <button
              onClick={() => setCompareSet(new Set())}
              className="text-xs text-accent hover:underline"
            >
              Clear comparison
            </button>
          </div>
          <div
            className={`grid gap-4 ${
              comparedSchools.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : comparedSchools.length === 3
                  ? 'grid-cols-1 sm:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}
          >
            {comparedSchools.map((r) => {
              const tier = getDisplayTier(r.name, r.selectivityTier);
              return (
                <div key={r.unitId} className="rounded-lg border border-gray-100 p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: TIER_COLORS[tier] ?? '#9ca3af' }}
                    />
                    <Link
                      href={`/schools/${r.unitId}?from=colleges`}
                      className="truncate text-sm font-semibold text-accent hover:underline"
                    >
                      {r.name}
                    </Link>
                  </div>
                  <p className="mb-2 text-xs text-text-secondary">{r.state} &middot; {tier}</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Avg 5yr</span>
                      <span className="font-medium text-earn-above">{formatCurrency(r.weightedEarn5yr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Avg 1yr</span>
                      <span className="font-medium text-earn-above">{formatCurrency(r.weightedEarn1yr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Payback</span>
                      <span className="font-semibold">{formatPayback(r.paybackYears)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Cost</span>
                      <span className="font-medium">{formatCurrency(r.costAttendance)}</span>
                    </div>
                    <hr className="border-gray-100" />
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Admit Rate</span>
                      <span>{formatRate(r.admissionRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Programs</span>
                      <span>{formatNumber(r.programCount)}</span>
                    </div>
                    {r.topProgram && (
                      <div className="flex justify-between gap-2">
                        <span className="text-text-secondary">Top Program</span>
                        <span className="truncate text-right">{r.topProgram}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
        <div className="flex-1 sm:flex-none">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            Search Schools
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="School name..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 pr-7 text-xs text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-accent sm:w-48"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-text-secondary hover:text-text-primary"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            Min Programs
          </label>
          <select
            value={minPrograms}
            onChange={(e) => {
              setMinPrograms(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
          >
            {[1, 3, 5, 10, 25].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            School Type
          </label>
          <div className="flex rounded-lg border border-gray-200 bg-white text-xs">
            {(
              [
                [null, 'All'],
                [1, 'Public'],
                [2, 'Private'],
                [3, 'For-Profit'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={String(val)}
                onClick={() => {
                  setOwnershipFilter(val);
                  setPage(1);
                }}
                className={`px-2.5 py-1.5 transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  ownershipFilter === val
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {states.length > 1 && (
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-secondary">
              State
            </label>
            <select
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
            >
              <option value="">All States</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        {filtersActive && (
          <button
            onClick={() => {
              setSearchQuery('');
              setOwnershipFilter(null);
              setStateFilter('');
              setPage(1);
            }}
            className="rounded-lg px-2 py-1.5 text-xs text-accent hover:bg-accent/10"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Count */}
      <p className="mb-2 text-xs text-text-secondary">
        {filtered.length} of {schoolRankings.length} colleges
        {compareSet.size > 0 && (
          <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-accent">
            {compareSet.size}/4 selected
          </span>
        )}
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-left">
          <thead className="border-b border-gray-100 bg-gray-50/50">
            <tr>
              <th className="w-10 px-2 py-2" />
              <th className="px-3 py-2 text-xs font-medium text-text-secondary">
                #
              </th>
              <th
                className="cursor-pointer px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary"
                onClick={() => handleSort('name')}
              >
                School{sortArrow('name')}
              </th>
              <th
                className="cursor-pointer px-3 py-2 text-right text-xs font-medium text-text-secondary hover:text-text-primary"
                onClick={() => handleSort('weightedEarn5yr')}
              >
                Avg 5yr{sortArrow('weightedEarn5yr')}
              </th>
              <th
                className="hidden cursor-pointer px-3 py-2 text-right text-xs font-medium text-text-secondary hover:text-text-primary sm:table-cell"
                onClick={() => handleSort('weightedEarn1yr')}
              >
                Avg 1yr{sortArrow('weightedEarn1yr')}
              </th>
              <th
                className="cursor-pointer px-3 py-2 text-right text-xs font-medium text-text-secondary hover:text-text-primary"
                onClick={() => handleSort('paybackYears')}
              >
                Payback{sortArrow('paybackYears')}
              </th>
              <th className="hidden px-3 py-2 text-xs font-medium text-text-secondary sm:table-cell">
                Top Program
              </th>
              <th
                className="hidden cursor-pointer px-3 py-2 text-right text-xs font-medium text-text-secondary hover:text-text-primary sm:table-cell"
                onClick={() => handleSort('programCount')}
              >
                Programs{sortArrow('programCount')}
              </th>
              <th
                className="hidden cursor-pointer px-3 py-2 text-right text-xs font-medium text-text-secondary hover:text-text-primary md:table-cell"
                onClick={() => handleSort('admissionRate')}
              >
                Admit{sortArrow('admissionRate')}
              </th>
              <th
                className="hidden cursor-pointer px-3 py-2 text-right text-xs font-medium text-text-secondary hover:text-text-primary md:table-cell"
                onClick={() => handleSort('costAttendance')}
              >
                Cost{sortArrow('costAttendance')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r, i) => {
              const rank = (currentPage - 1) * PAGE_SIZE + i + 1;
              const tier = getDisplayTier(r.name, r.selectivityTier);
              return (
                <tr
                  key={r.unitId}
                  className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                >
                  <td
                    className="w-10 px-2 py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={compareSet.has(r.unitId)}
                      onChange={() => handleCompareToggle(r.unitId)}
                      disabled={!compareSet.has(r.unitId) && compareSet.size >= 4}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-accent accent-accent"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-text-secondary">
                    {rank}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                        style={{
                          backgroundColor: TIER_COLORS[tier] ?? '#9ca3af',
                        }}
                      />
                      <Link
                        href={`/schools/${r.unitId}?from=colleges`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        {r.name}
                      </Link>
                      <span className="text-xs text-text-secondary">
                        {r.state}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums font-medium text-earn-above">
                    {formatCurrency(r.weightedEarn5yr)}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-text-secondary sm:table-cell">
                    {formatCurrency(r.weightedEarn1yr)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums font-semibold text-text-primary">
                    {formatPayback(r.paybackYears)}
                  </td>
                  <td className="hidden max-w-[200px] truncate px-3 py-2.5 text-xs text-text-secondary sm:table-cell">
                    {r.topProgram ?? '\u2014'}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-text-secondary sm:table-cell">
                    {formatNumber(r.programCount)}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-text-secondary md:table-cell">
                    {formatRate(r.admissionRate)}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-text-secondary md:table-cell">
                    {formatCurrency(r.costAttendance)}
                  </td>
                </tr>
              );
            })}
            {paginated.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-8 text-center text-sm text-text-secondary"
                >
                  No colleges match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-text-secondary">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-md px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-gray-100 disabled:opacity-40"
            >
              Prev
            </button>
            {pageNumbers[0] > 1 && (
              <>
                <button
                  onClick={() => setPage(1)}
                  className="rounded-md px-2.5 py-1 text-xs text-text-secondary hover:bg-gray-100"
                >
                  1
                </button>
                {pageNumbers[0] > 2 && (
                  <span className="px-1 text-xs text-text-secondary">
                    &hellip;
                  </span>
                )}
              </>
            )}
            {pageNumbers.map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  n === currentPage
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:bg-gray-100'
                }`}
              >
                {n}
              </button>
            ))}
            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span className="px-1 text-xs text-text-secondary">
                    &hellip;
                  </span>
                )}
                <button
                  onClick={() => setPage(totalPages)}
                  className="rounded-md px-2.5 py-1 text-xs text-text-secondary hover:bg-gray-100"
                >
                  {totalPages}
                </button>
              </>
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-md px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-gray-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
