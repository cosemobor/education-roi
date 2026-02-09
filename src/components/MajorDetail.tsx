'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import Link from 'next/link';
import type { MajorSummary, ProgramRecord, SortDir } from '@/types';
import { formatCurrency, formatCompact, formatRate, formatNumber, formatPercent } from '@/lib/formatters';
import { getDisplayTier, TIER_COLORS, TIER_ORDER } from '@/lib/tiers';
import { generateMajorDescription } from '@/lib/descriptions';
import StatCard from './StatCard';

type EarningsKey = 'earn1yr' | 'earn5yr';
type SortField = 'schoolName' | 'earn1yr' | 'earn5yr' | 'cost' | 'multiple' | 'admissionRate';

const PAGE_SIZE = 25;

interface DotDatum {
  x: number;
  y: number;
  unitId: number;
  schoolName: string;
  state: string;
  tier: string;
  credTitle: string;
  costAttendance: number;
  earnings: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DotDatum }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-text-primary">{d.schoolName}</p>
      <p className="text-xs text-text-secondary">{d.state} &middot; {d.credTitle}</p>
      <div className="mt-1.5 flex gap-4 text-xs">
        <span>Earnings: <strong className="text-earn-above">{formatCurrency(d.earnings)}</strong></span>
        <span>Cost: <strong>{formatCurrency(d.costAttendance)}</strong></span>
      </div>
      <span
        className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: TIER_COLORS[d.tier] ?? '#9ca3af' }}
      >
        {d.tier}
      </span>
      <p className="mt-1.5 text-[10px] text-text-secondary">Click to view school</p>
    </div>
  );
}

interface MajorDetailProps {
  major: MajorSummary;
  programs: ProgramRecord[];
  fromTab?: string;
}

interface RankedRow {
  rank: number;
  unitId: number;
  schoolName: string;
  state: string;
  tier: string;
  credTitle: string;
  earn1yr: number | null;
  earn5yr: number | null;
  cost: number;
  multiple: number;
  admissionRate: number | null;
  satCombined: number | null;
}

export default function MajorDetail({ major, programs, fromTab }: MajorDetailProps) {
  const [sortField, setSortField] = useState<SortField>('earn1yr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<number | null>(null);
  const [stateFilter, setStateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [earningsKey, setEarningsKey] = useState<EarningsKey>('earn1yr');
  const [selectedSchool, setSelectedSchool] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Close detail card on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedSchool(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const states = useMemo(() => {
    const s = new Set(programs.map((p) => p.state).filter(Boolean));
    return Array.from(s).sort();
  }, [programs]);

  // Build ranked rows from programs
  const allRows = useMemo(() => {
    return programs
      .filter((p) => p.earn1yr != null || p.earn5yr != null)
      .map((p) => ({
        rank: 0,
        unitId: p.unitId,
        schoolName: p.schoolName,
        state: p.state,
        tier: getDisplayTier(p.schoolName, p.selectivityTier || ''),
        credTitle: p.credTitle,
        earn1yr: p.earn1yr,
        earn5yr: p.earn5yr,
        cost: p.costAttendance ?? 0,
        multiple:
          p.costAttendance && p.earn1yr
            ? p.earn1yr / p.costAttendance
            : 0,
        admissionRate: p.admissionRate,
        satCombined:
          p.satMath75 != null && p.satRead75 != null
            ? p.satMath75 + p.satRead75
            : null,
      }));
  }, [programs]);

  // Apply filters
  const filtered = useMemo(() => {
    let rows = allRows;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) => r.schoolName.toLowerCase().includes(q));
    }
    if (ownershipFilter != null) {
      const matching = new Set(
        programs
          .filter((p) => p.ownership === ownershipFilter)
          .map((p) => p.unitId),
      );
      rows = rows.filter((r) => matching.has(r.unitId));
    }
    if (stateFilter) {
      rows = rows.filter((r) => r.state === stateFilter);
    }
    return rows;
  }, [allRows, searchQuery, ownershipFilter, stateFilter, programs]);

  // Chart data — filtered rows with valid cost + earnings
  const chartFiltered = useMemo(() => {
    return filtered.filter((r) => r.cost > 0 && r[earningsKey] != null);
  }, [filtered, earningsKey]);

  const tierData = useMemo(() => {
    const groups: Record<string, DotDatum[]> = {};
    for (const r of chartFiltered) {
      if (!groups[r.tier]) groups[r.tier] = [];
      groups[r.tier].push({
        x: r.cost,
        y: r[earningsKey]!,
        unitId: r.unitId,
        schoolName: r.schoolName,
        state: r.state,
        tier: r.tier,
        credTitle: r.credTitle,
        costAttendance: r.cost,
        earnings: r[earningsKey]!,
      });
    }
    return groups;
  }, [chartFiltered, earningsKey]);

  const { yDomain, xDomain } = useMemo(() => {
    if (!chartFiltered.length)
      return {
        yDomain: [0, 100000] as [number, number],
        xDomain: [0, 80000] as [number, number],
      };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const r of chartFiltered) {
      const x = r.cost;
      const y = r[earningsKey]!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const yPad = (maxY - minY) * 0.1 || 5000;
    const xPad = (maxX - minX) * 0.05 || 2000;
    return {
      yDomain: [Math.max(0, minY - yPad), maxY + yPad] as [number, number],
      xDomain: [Math.max(0, minX - xPad), maxX + xPad] as [number, number],
    };
  }, [chartFiltered, earningsKey]);

  const medianLine = earningsKey === 'earn1yr' ? major.medianEarn1yr : major.medianEarn5yr;

  const earningsLabel = earningsKey === 'earn1yr' ? '1-Year' : '5-Year';

  const handleDotClick = useCallback((data: any) => {
    const uid = data?.unitId ?? data?.payload?.unitId;
    if (uid != null) {
      setSelectedSchool((prev) => (prev === uid ? null : uid));
    }
  }, []);

  const handleRowClick = useCallback((unitId: number) => {
    setSelectedSchool((prev) => (prev === unitId ? null : unitId));
    chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const selectedRow = useMemo(() => {
    if (selectedSchool == null) return null;
    return filtered.find((r) => r.unitId === selectedSchool) ?? null;
  }, [selectedSchool, filtered]);

  // Custom dot shape — highlights selected school
  const renderDot = useCallback(
    (props: any) => {
      const { cx, cy, fill, payload } = props;
      if (cx == null || cy == null) return <circle cx={0} cy={0} r={0} />;
      const uid = payload?.unitId;
      const isSelected = uid != null && uid === selectedSchool;
      if (isSelected) {
        return (
          <g>
            <circle cx={cx} cy={cy} r={14} fill={fill} opacity={0.12} />
            <circle cx={cx} cy={cy} r={7} fill={fill} stroke="#1a1a1a" strokeWidth={2.5} />
          </g>
        );
      }
      return <circle cx={cx} cy={cy} r={5} fill={fill} opacity={0.75} />;
    },
    [selectedSchool],
  );

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
    rows.forEach((r, i) => (r.rank = i + 1));
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
      setSortDir(field === 'schoolName' ? 'asc' : 'desc');
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

  // Page number generation
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const filtersActive = !!(searchQuery || ownershipFilter != null || stateFilter);

  return (
    <div>
      {/* Back link + title */}
      <Link
        href={`/?tab=${fromTab || 'majors'}`}
        className="mb-4 inline-block text-sm text-accent hover:underline"
      >
        &larr; All Majors
      </Link>
      <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
        {major.cipTitle.replace(/\.+$/, '')}
      </h1>
      <p className="mt-1 text-sm text-text-secondary">
        CIP {major.cipCode} &middot; {major.schoolCount} schools
      </p>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">
        {generateMajorDescription(major)}
      </p>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Schools" value={formatNumber(major.schoolCount)} />
        <StatCard
          label="Median 1yr"
          value={formatCurrency(major.medianEarn1yr)}
        />
        <StatCard
          label="Median 5yr"
          value={formatCurrency(major.medianEarn5yr)}
        />
        <StatCard
          label="Earnings Growth"
          value={formatPercent(major.growthRate)}
        />
      </div>

      {/* Scatter chart */}
      {chartFiltered.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              Earnings vs. Cost &mdash; {chartFiltered.length} Schools
            </h2>
            <div className="flex rounded-lg border border-gray-200 text-xs">
              <button
                onClick={() => setEarningsKey('earn1yr')}
                className={`px-3 py-1.5 transition-colors rounded-l-lg ${
                  earningsKey === 'earn1yr'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                1-Year
              </button>
              <button
                onClick={() => setEarningsKey('earn5yr')}
                className={`px-3 py-1.5 transition-colors rounded-r-lg ${
                  earningsKey === 'earn5yr'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                5-Year
              </button>
            </div>
          </div>

          <div
            ref={chartRef}
            className="rounded-lg border border-gray-100 bg-white p-2 shadow-sm sm:p-4"
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
                  name="Cost"
                  domain={xDomain}
                  tickFormatter={(v: number) => formatCompact(v)}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  label={{
                    value: 'Cost of Attendance',
                    position: 'insideBottom',
                    offset: -10,
                    fontSize: 12,
                    fill: '#6b7280',
                  }}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name="Earnings"
                  domain={yDomain}
                  tickFormatter={(v: number) => formatCompact(v)}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  width={60}
                  label={{
                    value: `${earningsLabel} Earnings`,
                    angle: -90,
                    position: 'insideLeft',
                    offset: 5,
                    fontSize: 12,
                    fill: '#6b7280',
                  }}
                />
                <Tooltip content={<ChartTooltip />} cursor={false} />
                {medianLine && (
                  <ReferenceLine
                    y={medianLine}
                    stroke="#6b7280"
                    strokeDasharray="6 4"
                    label={{
                      value: `National Median ${formatCompact(medianLine)}`,
                      position: 'right',
                      fontSize: 11,
                      fill: '#6b7280',
                    }}
                  />
                )}
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
                />
                {TIER_ORDER.map(
                  (tier) =>
                    tierData[tier] && (
                      <Scatter
                        key={tier}
                        name={tier}
                        data={tierData[tier]}
                        fill={TIER_COLORS[tier]}
                        shape={renderDot}
                        onClick={handleDotClick}
                      />
                    ),
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Detail card — shown when a school dot is selected */}
          {selectedRow && (
            <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: TIER_COLORS[selectedRow.tier] ?? '#9ca3af' }}
                    />
                    <span className="truncate text-base font-semibold text-text-primary">
                      {selectedRow.schoolName}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {selectedRow.state} &middot; {selectedRow.credTitle} &middot; {selectedRow.tier}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSchool(null)}
                  className="rounded-lg px-2 py-1 text-lg text-text-secondary hover:text-text-primary"
                >
                  &times;
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">1yr Earnings</p>
                  <p className="text-sm font-semibold text-earn-above">{formatCurrency(selectedRow.earn1yr)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">5yr Earnings</p>
                  <p className="text-sm font-semibold text-earn-above">
                    {selectedRow.earn5yr != null ? formatCurrency(selectedRow.earn5yr) : '\u2014'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">Cost</p>
                  <p className="text-sm font-semibold">{selectedRow.cost > 0 ? formatCurrency(selectedRow.cost) : '\u2014'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">ROI</p>
                  <p className="text-sm font-semibold">{selectedRow.multiple > 0 ? selectedRow.multiple.toFixed(1) + 'x' : '\u2014'}</p>
                </div>
              </div>

              <Link
                href={`/schools/${selectedRow.unitId}?from=majors`}
                className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
              >
                View school details &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
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
            School Type
          </label>
          <div className="flex rounded-lg border border-gray-200 bg-white text-xs">
            {([
              [null, 'All'],
              [1, 'Public'],
              [2, 'Private'],
              [3, 'For-Profit'],
            ] as const).map(([val, label]) => (
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
      <p className="mt-2 text-xs text-text-secondary">
        Showing {sorted.length} of {allRows.length} programs
      </p>

      {/* Table */}
      <div className="mt-3 overflow-x-auto rounded-lg border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-xs">
          <thead className="border-b border-gray-100 bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-text-secondary">#</th>
              <th
                className="cursor-pointer px-3 py-2 font-medium text-text-secondary hover:text-text-primary"
                onClick={() => handleSort('schoolName')}
              >
                School{sortArrow('schoolName')}
              </th>
              <th
                className="cursor-pointer px-3 py-2 text-right font-medium text-text-secondary hover:text-text-primary"
                onClick={() => handleSort('earn1yr')}
              >
                1yr Earnings{sortArrow('earn1yr')}
              </th>
              <th
                className="hidden cursor-pointer px-3 py-2 text-right font-medium text-text-secondary hover:text-text-primary sm:table-cell"
                onClick={() => handleSort('earn5yr')}
              >
                5yr Earnings{sortArrow('earn5yr')}
              </th>
              <th
                className="hidden cursor-pointer px-3 py-2 text-right font-medium text-text-secondary hover:text-text-primary sm:table-cell"
                onClick={() => handleSort('cost')}
              >
                Cost{sortArrow('cost')}
              </th>
              <th
                className="cursor-pointer px-3 py-2 text-right font-medium text-text-secondary hover:text-text-primary"
                onClick={() => handleSort('multiple')}
              >
                ROI{sortArrow('multiple')}
              </th>
              <th
                className="hidden cursor-pointer px-3 py-2 text-right font-medium text-text-secondary hover:text-text-primary md:table-cell"
                onClick={() => handleSort('admissionRate')}
              >
                Admit{sortArrow('admissionRate')}
              </th>
              <th className="hidden px-3 py-2 text-right font-medium text-text-secondary lg:table-cell">
                SAT
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r) => (
              <tr
                key={`${r.unitId}-${r.rank}`}
                className={`cursor-pointer border-t border-gray-50 transition-colors ${
                  selectedSchool === r.unitId ? 'bg-accent/10' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleRowClick(r.unitId)}
              >
                <td className="px-3 py-2 text-text-secondary">{r.rank}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                      style={{
                        backgroundColor: TIER_COLORS[r.tier] ?? '#9ca3af',
                      }}
                    />
                    <Link
                      href={`/schools/${r.unitId}?from=majors`}
                      className="font-medium text-accent hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.schoolName}
                    </Link>
                    <span className="text-text-secondary">{r.state}</span>
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-medium text-earn-above">
                  {formatCurrency(r.earn1yr)}
                </td>
                <td className="hidden px-3 py-2 text-right font-medium text-earn-above sm:table-cell">
                  {r.earn5yr != null ? formatCurrency(r.earn5yr) : '\u2014'}
                </td>
                <td className="hidden px-3 py-2 text-right text-text-secondary sm:table-cell">
                  {r.cost > 0 ? formatCurrency(r.cost) : '\u2014'}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-text-primary">
                  {r.multiple > 0 ? r.multiple.toFixed(1) + 'x' : '\u2014'}
                </td>
                <td className="hidden px-3 py-2 text-right text-text-secondary md:table-cell">
                  {formatRate(r.admissionRate)}
                </td>
                <td className="hidden px-3 py-2 text-right text-text-secondary lg:table-cell">
                  {r.satCombined != null ? r.satCombined.toLocaleString() : '\u2014'}
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-sm text-text-secondary"
                >
                  No programs match your filters
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
