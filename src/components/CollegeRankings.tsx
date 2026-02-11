'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { SchoolRanking, SortDir } from '@/types';
import { formatCurrency, formatCompact, formatRate, formatNumber } from '@/lib/formatters';
import { getDisplayTier, TIER_COLORS, TIER_ORDER } from '@/lib/tiers';
import { trackEvent } from '@/lib/analytics';
import StatCard from './StatCard';
import SortableHeader from './SortableHeader';

interface ScatterDatum {
  x: number;
  y: number;
  unitId: number;
  name: string;
  state: string;
  tier: string;
  admissionRate: number | null;
  earnings: number;
  costAttendance: number;
  programCount: number;
  roi: number | null;
  topProgram: string | null;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterDatum }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-text-primary">{d.name}</p>
      <p className="text-xs text-text-secondary">{d.state}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        <span>Earnings: <strong className="text-earn-above">{formatCurrency(d.earnings)}</strong></span>
        <span>Cost: <strong>{formatCurrency(d.costAttendance)}</strong></span>
        <span>Programs: <strong>{d.programCount}</strong></span>
        {d.roi != null && (
          <span>ROI: <strong>{d.roi.toFixed(1)}x</strong></span>
        )}
      </div>
      {d.admissionRate != null && (
        <p className="mt-1 text-[10px] text-text-secondary">
          Acceptance: {formatRate(d.admissionRate)}
        </p>
      )}
      <span
        className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: TIER_COLORS[d.tier] ?? '#9ca3af' }}
      >
        {d.tier}
      </span>
      <p className="mt-1.5 text-[10px] text-text-secondary">Click to see details</p>
    </div>
  );
}

type SortField =
  | 'name'
  | 'weightedEarn1yr'
  | 'weightedEarn5yr'
  | 'roi'
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
  const [sortField, setSortField] = useState<SortField>('weightedEarn1yr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<number | null>(null);
  const [stateFilter, setStateFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [minPrograms, setMinPrograms] = useState(5);
  const [page, setPage] = useState(1);
  const [compareSet, setCompareSet] = useState<Set<number>>(new Set());
  const [chartEarnings, setChartEarnings] = useState<'earn1yr' | 'earn5yr'>('earn5yr');
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
    if (tierFilter) {
      rows = rows.filter((r) => getDisplayTier(r.name, r.selectivityTier, r.admissionRate, r.size) === tierFilter);
    }
    return rows;
  }, [schoolRankings, searchQuery, ownershipFilter, stateFilter, tierFilter, minPrograms]);

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
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
    setPage(1);
  }, [sortField]);

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
    const withEarn = filtered.filter((r) => r.weightedEarn1yr != null);
    const highest = withEarn.length
      ? withEarn.reduce((best, r) =>
          (r.weightedEarn1yr ?? 0) > (best.weightedEarn1yr ?? 0) ? r : best,
          withEarn[0],
        )
      : null;
    const withROI = filtered.filter((r) => r.roi != null);
    const bestROI = withROI.length
      ? withROI.reduce((best, r) =>
          (r.roi ?? 0) > (best.roi ?? 0) ? r : best,
          withROI[0],
        )
      : null;
    return { total: filtered.length, highest, bestROI };
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

  // Scatter chart data — built from ALL schools (minPrograms baseline) for dim/highlight
  const earningsKey = chartEarnings === 'earn1yr' ? 'weightedEarn1yr' : 'weightedEarn5yr';

  const allChartData = useMemo(() => {
    const all: ScatterDatum[] = [];
    for (const r of schoolRankings) {
      if (r.programCount < minPrograms) continue;
      if (r.costAttendance == null || r[earningsKey] == null) continue;
      const tier = getDisplayTier(r.name, r.selectivityTier, r.admissionRate, r.size);
      all.push({
        x: r.costAttendance,
        y: r[earningsKey]!,
        unitId: r.unitId,
        name: r.name,
        state: r.state,
        tier,
        admissionRate: r.admissionRate,
        earnings: r[earningsKey]!,
        costAttendance: r.costAttendance,
        programCount: r.programCount,
        roi: r.roi,
        topProgram: r.topProgram,
      });
    }
    return all;
  }, [schoolRankings, minPrograms, earningsKey]);

  // Axis domains
  const { xDomain, yDomain } = useMemo(() => {
    let maxX = 0, maxY = 0;
    for (const d of allChartData) {
      if (d.x > maxX) maxX = d.x;
      if (d.y > maxY) maxY = d.y;
    }
    const xPad = maxX * 0.05 || 5000;
    const yPad = maxY * 0.05 || 5000;
    return {
      xDomain: [0, maxX + xPad] as [number, number],
      yDomain: [0, maxY + yPad] as [number, number],
    };
  }, [allChartData]);

  // Dim/highlight split
  const hasActiveFilter = !!(searchQuery.trim() || ownershipFilter != null || stateFilter || tierFilter || compareSet.size > 0);

  const { dimmedData, highlightedByTier } = useMemo(() => {
    if (!hasActiveFilter) {
      const groups: Record<string, ScatterDatum[]> = {};
      for (const d of allChartData) {
        if (!groups[d.tier]) groups[d.tier] = [];
        groups[d.tier].push(d);
      }
      return { dimmedData: [] as ScatterDatum[], highlightedByTier: groups };
    }
    const highlightIds = compareSet.size > 0
      ? compareSet
      : new Set(filtered.map((r) => r.unitId));
    const dimmed: ScatterDatum[] = [];
    const groups: Record<string, ScatterDatum[]> = {};
    for (const d of allChartData) {
      if (highlightIds.has(d.unitId)) {
        if (!groups[d.tier]) groups[d.tier] = [];
        groups[d.tier].push(d);
      } else {
        dimmed.push(d);
      }
    }
    return { dimmedData: dimmed, highlightedByTier: groups };
  }, [allChartData, filtered, compareSet, hasActiveFilter]);

  const hasScatterData = allChartData.length > 0;

  // Click dot → toggle detail card (not navigate away)
  const handleDotClick = useCallback((data: any) => {
    const uid = data?.unitId ?? data?.payload?.unitId;
    if (uid != null) {
      trackEvent('school_click', { unitId: uid });
      setSelectedSchool((prev) => (prev === uid ? null : uid));
    }
  }, []);

  const selectedSchoolData = useMemo(() => {
    if (selectedSchool == null) return null;
    return allChartData.find((d) => d.unitId === selectedSchool) ?? null;
  }, [selectedSchool, allChartData]);

  // Custom dot shape — highlights selected school
  const renderDot = useCallback(
    (props: any) => {
      const { cx, cy, fill, payload } = props;
      if (cx == null || cy == null) return <circle cx={0} cy={0} r={0} />;
      const isSelected = payload?.unitId != null && payload.unitId === selectedSchool;
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

  const handleRowClick = useCallback((unitId: number) => {
    setSelectedSchool((prev) => (prev === unitId ? null : unitId));
    chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const filtersActive = !!(
    searchQuery ||
    ownershipFilter != null ||
    stateFilter ||
    tierFilter
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
              ? formatCurrency(stats.highest.weightedEarn1yr)
              : '\u2014'
          }
          detail={stats.highest?.name}
        />
        <StatCard
          label="Best ROI"
          value={stats.bestROI?.roi != null ? stats.bestROI.roi.toFixed(1) + 'x' : '\u2014'}
          detail={stats.bestROI?.name}
        />
      </div>

      {/* Scatter chart */}
      {hasScatterData && (
        <div
          ref={chartRef}
          data-tour="scatter-chart"
          className="mb-6 rounded-lg border border-gray-100 bg-white p-2 shadow-sm sm:p-4"
          style={{ userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest?.('svg')) e.preventDefault();
          }}
        >
          <div className="mb-2 flex items-center justify-between px-2">
            <h3 className="text-sm font-semibold text-text-primary">
              Cost of Attendance vs Earnings
            </h3>
            <div className="flex rounded-lg border border-gray-200 text-xs">
              <button
                onClick={() => setChartEarnings('earn1yr')}
                className={`rounded-l-lg px-3 py-1.5 transition-colors ${
                  chartEarnings === 'earn1yr'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                1-Year
              </button>
              <button
                onClick={() => setChartEarnings('earn5yr')}
                className={`rounded-r-lg px-3 py-1.5 transition-colors ${
                  chartEarnings === 'earn5yr'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                5-Year
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={420}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="x"
                type="number"
                domain={xDomain}
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                label={{ value: 'Cost of Attendance', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                dataKey="y"
                type="number"
                domain={yDomain}
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                width={60}
                label={{
                  value: chartEarnings === 'earn1yr' ? 'Avg 1yr Earnings' : 'Avg 5yr Earnings',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 5,
                  fontSize: 12,
                  fill: '#6b7280',
                }}
              />
              <Tooltip content={<ChartTooltip />} cursor={false} />
              <ReferenceLine
                segment={[{ x: 0, y: 0 }, { x: xDomain[1], y: xDomain[1] }]}
                stroke="#ef4444"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                strokeOpacity={0.6}
              />
              {/* Dimmed background points (non-matching when filter active) */}
              {dimmedData.length > 0 && (
                <Scatter
                  name="Other"
                  data={dimmedData}
                  fill="#d1d5db"
                  fillOpacity={0.3}
                  shape={renderDot}
                  onClick={handleDotClick}
                  isAnimationActive={false}
                />
              )}
              {/* Highlighted points by tier — reverse so top tiers render last (on top) */}
              {[...TIER_ORDER].reverse().map(
                (tier) =>
                  highlightedByTier[tier] && (
                    <Scatter
                      key={tier}
                      name={tier}
                      data={highlightedByTier[tier]}
                      fill={TIER_COLORS[tier]}
                      fillOpacity={0.75}
                      shape={renderDot}
                      onClick={handleDotClick}
                    />
                  ),
              )}
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {TIER_ORDER.map((tier) => {
              const hasHighlighted = !!highlightedByTier[tier];
              return (
                <span
                  key={tier}
                  className={`flex items-center gap-1.5 text-xs ${
                    hasHighlighted || !hasActiveFilter
                      ? 'text-text-secondary'
                      : 'text-text-secondary/40'
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        hasHighlighted || !hasActiveFilter
                          ? TIER_COLORS[tier]
                          : '#d1d5db',
                    }}
                  />
                  {tier}
                </span>
              );
            })}
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="inline-block h-0 w-4 border-t-[1.5px] border-dashed" style={{ borderColor: '#ef4444', opacity: 0.6 }} />
              Break Even
            </span>
          </div>

          {/* Detail card — shown when a school dot is selected */}
          {selectedSchoolData && (
            <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: TIER_COLORS[selectedSchoolData.tier] ?? '#9ca3af' }}
                    />
                    <span className="truncate text-base font-semibold text-text-primary">
                      {selectedSchoolData.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {selectedSchoolData.state} &middot; {selectedSchoolData.tier}
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
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">Earnings</p>
                  <p className="text-sm font-semibold text-earn-above">{formatCurrency(selectedSchoolData.earnings)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">Cost</p>
                  <p className="text-sm font-semibold">{formatCurrency(selectedSchoolData.costAttendance)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">ROI</p>
                  <p className="text-sm font-semibold">{selectedSchoolData.roi != null ? selectedSchoolData.roi.toFixed(1) + 'x' : '\u2014'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">Admit Rate</p>
                  <p className="text-sm font-semibold">{formatRate(selectedSchoolData.admissionRate)}</p>
                </div>
              </div>

              {selectedSchoolData.topProgram && (
                <p className="mt-2 text-xs text-text-secondary">
                  Top program: <span className="font-medium text-text-primary">{selectedSchoolData.topProgram}</span>
                </p>
              )}

              <Link
                href={`/schools/${selectedSchoolData.unitId}?from=colleges`}
                className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
              >
                View school details &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

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
              const tier = getDisplayTier(r.name, r.selectivityTier, r.admissionRate, r.size);
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
                      <span className="text-text-secondary">Avg 1yr</span>
                      <span className="font-medium text-earn-above">{formatCurrency(r.weightedEarn1yr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Avg 5yr</span>
                      <span className="font-medium text-earn-above">{formatCurrency(r.weightedEarn5yr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Cost</span>
                      <span className="font-medium">{formatCurrency(r.costAttendance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">ROI</span>
                      <span className="font-semibold">{r.roi != null ? r.roi.toFixed(1) + 'x' : '\u2014'}</span>
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

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            Tier
          </label>
          <select
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
          >
            <option value="">All Tiers</option>
            {TIER_ORDER.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {filtersActive && (
          <button
            onClick={() => {
              setSearchQuery('');
              setOwnershipFilter(null);
              setStateFilter('');
              setTierFilter('');
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
              <SortableHeader<SortField>
                label="School"
                sortKey="name"
                currentSortKey={sortField}
                currentSortDir={sortDir}
                onClick={handleSort}
              />
              <SortableHeader<SortField>
                label="1yr Earnings"
                sortKey="weightedEarn1yr"
                currentSortKey={sortField}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="text-right"
              />
              <SortableHeader<SortField>
                label="5yr Earnings"
                sortKey="weightedEarn5yr"
                currentSortKey={sortField}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="hidden text-right sm:table-cell"
              />
              <SortableHeader<SortField>
                label="Cost"
                sortKey="costAttendance"
                currentSortKey={sortField}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="hidden text-right sm:table-cell"
              />
              <SortableHeader<SortField>
                label="ROI"
                sortKey="roi"
                currentSortKey={sortField}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="text-right"
              />
              <SortableHeader<SortField>
                label="Admit"
                sortKey="admissionRate"
                currentSortKey={sortField}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="hidden text-right md:table-cell"
              />
              <th className="hidden px-3 py-2 text-xs font-medium text-text-secondary sm:table-cell">
                Top Program
              </th>
              <SortableHeader<SortField>
                label="Programs"
                sortKey="programCount"
                currentSortKey={sortField}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="hidden text-right md:table-cell"
              />
            </tr>
          </thead>
          <tbody>
            {paginated.map((r, i) => {
              const rank = (currentPage - 1) * PAGE_SIZE + i + 1;
              const tier = getDisplayTier(r.name, r.selectivityTier, r.admissionRate, r.size);
              return (
                <tr
                  key={r.unitId}
                  onClick={() => handleRowClick(r.unitId)}
                  className={`cursor-pointer border-b border-gray-50 transition-colors ${
                    selectedSchool === r.unitId
                      ? 'bg-accent/10'
                      : 'hover:bg-gray-50'
                  }`}
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
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-text-secondary w-10">
                    {rank}
                  </td>
                  <td className="px-3 py-2.5 text-sm">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                        style={{
                          backgroundColor: TIER_COLORS[tier] ?? '#9ca3af',
                        }}
                      />
                      <Link
                        href={`/schools/${r.unitId}?from=colleges`}
                        className="font-medium text-accent hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.name}
                      </Link>
                      <span className="text-xs text-text-secondary">
                        {r.state}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums font-medium text-earn-above">
                    {formatCurrency(r.weightedEarn1yr)}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-text-secondary sm:table-cell">
                    {formatCurrency(r.weightedEarn5yr)}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-text-secondary sm:table-cell">
                    {formatCurrency(r.costAttendance)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums font-semibold text-text-primary">
                    {r.roi != null ? r.roi.toFixed(1) + 'x' : '\u2014'}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-text-secondary md:table-cell">
                    {formatRate(r.admissionRate)}
                  </td>
                  <td className="hidden max-w-[200px] truncate px-3 py-2.5 text-xs text-text-secondary sm:table-cell">
                    {r.topProgram ?? '\u2014'}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-text-secondary md:table-cell">
                    {formatNumber(r.programCount)}
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
