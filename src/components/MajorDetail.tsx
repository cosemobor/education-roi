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
} from 'recharts';
import Link from 'next/link';
import type { MajorSummary, ProgramRecord, SortDir } from '@/types';
import { formatCurrency, formatCompact, formatRate, formatNumber, formatPercent } from '@/lib/formatters';
import { getDisplayTier, TIER_COLORS, TIER_ORDER } from '@/lib/tiers';
import { generateMajorDescription } from '@/lib/descriptions';
import StatCard from './StatCard';
import ShareButton from './ShareButton';
import SortableHeader from './SortableHeader';

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
  admissionRate: number | null;
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
  const [tierFilter, setTierFilter] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [earningsKey, setEarningsKey] = useState<EarningsKey>('earn1yr');
  const [selectedSchool, setSelectedSchool] = useState<number | null>(null);
  const [compareSet, setCompareSet] = useState<Set<number>>(new Set());
  const chartRef = useRef<HTMLDivElement>(null);
  const dotClickedRef = useRef(false);

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
        tier: getDisplayTier(p.schoolName, p.selectivityTier || '', p.admissionRate, p.size),
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
    if (tierFilter.size > 0) {
      rows = rows.filter((r) => tierFilter.has(r.tier));
    }
    return rows;
  }, [allRows, searchQuery, ownershipFilter, stateFilter, tierFilter, programs]);

  // Static axes — computed from max of BOTH earn1yr and earn5yr so toggle doesn't rescale
  const { xDomain, yDomain, yTicks } = useMemo(() => {
    let maxX = 0, maxY = 0;
    for (const r of allRows) {
      if (r.cost <= 0) continue;
      if (r.cost > maxX) maxX = r.cost;
      if (r.earn1yr != null && r.earn1yr > maxY) maxY = r.earn1yr;
      if (r.earn5yr != null && r.earn5yr > maxY) maxY = r.earn5yr;
    }
    const yMax = Math.max(100000, Math.ceil(maxY / 25000) * 25000);
    const xMax = Math.max(80000, Math.ceil(maxX / 10000) * 10000);
    const ticks = Array.from({ length: yMax / 25000 + 1 }, (_, i) => i * 25000);
    return {
      xDomain: [0, xMax] as [number, number],
      yDomain: [0, yMax] as [number, number],
      yTicks: ticks,
    };
  }, [allRows]);

  // Chart data points — recomputed on toggle but axes stay fixed
  const allChartData = useMemo(() => {
    const all: DotDatum[] = [];
    for (const r of allRows) {
      if (r.cost <= 0 || r[earningsKey] == null) continue;
      all.push({
        x: r.cost,
        y: r[earningsKey]!,
        unitId: r.unitId,
        schoolName: r.schoolName,
        state: r.state,
        tier: r.tier,
        credTitle: r.credTitle,
        costAttendance: r.cost,
        earnings: r[earningsKey]!,
        admissionRate: r.admissionRate,
      });
    }
    return all;
  }, [allRows, earningsKey]);

  // Dim/highlight: when filters active, dim non-matching points
  const hasActiveFilter = !!(searchQuery.trim() || ownershipFilter != null || stateFilter || tierFilter.size > 0 || compareSet.size > 0);

  const { dimmedData, highlightedByTier } = useMemo(() => {
    if (!hasActiveFilter) {
      const groups: Record<string, DotDatum[]> = {};
      for (const d of allChartData) {
        if (!groups[d.tier]) groups[d.tier] = [];
        groups[d.tier].push(d);
      }
      return { dimmedData: [] as DotDatum[], highlightedByTier: groups };
    }
    const highlightIds = compareSet.size > 0
      ? compareSet
      : new Set(filtered.map((r) => r.unitId));
    const dimmed: DotDatum[] = [];
    const groups: Record<string, DotDatum[]> = {};
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

  const medianLine = earningsKey === 'earn1yr' ? major.medianEarn1yr : major.medianEarn5yr;

  const earningsLabel = earningsKey === 'earn1yr' ? '1-Year' : '5-Year';

  const handleDotClick = useCallback((data: any) => {
    const uid = data?.unitId ?? data?.payload?.unitId;
    if (uid != null) {
      dotClickedRef.current = true;
      setSelectedSchool((prev) => (prev === uid ? null : uid));
    }
  }, []);

  const handleRowClick = useCallback((unitId: number) => {
    setSelectedSchool((prev) => (prev === unitId ? null : unitId));
    chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

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

  const stats = useMemo(() => {
    const earnKey = earningsKey === 'earn1yr' ? 'earn1yr' : 'earn5yr';
    const withEarn = allRows.filter((r) => r[earnKey] != null);
    const highest = withEarn.length
      ? withEarn.reduce((best, r) =>
          (r[earnKey] ?? 0) > (best[earnKey] ?? 0) ? r : best,
          withEarn[0],
        )
      : null;
    return { highest, highestEarnKey: earnKey as 'earn1yr' | 'earn5yr' };
  }, [allRows, earningsKey]);

  const comparedSchools = useMemo(() => {
    if (compareSet.size === 0) return [];
    return allRows.filter((r) => compareSet.has(r.unitId));
  }, [allRows, compareSet]);

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

  const filtersActive = !!(searchQuery || ownershipFilter != null || stateFilter || tierFilter.size > 0);

  return (
    <div>
      {/* Back link + title */}
      <Link
        href={`/?tab=${fromTab || 'majors'}`}
        className="mb-4 inline-block text-sm text-accent hover:underline"
      >
        &larr; All Majors
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
            {major.cipTitle.replace(/\.+$/, '')}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            CIP {major.cipCode} &middot; {major.schoolCount} schools
          </p>
        </div>
        <ShareButton title={`${major.cipTitle.replace(/\.+$/, '')} - Earnings Data`} text={`Earnings data for ${major.cipTitle.replace(/\.+$/, '')} across ${major.schoolCount} schools`} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">
        {generateMajorDescription(major)}
      </p>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Schools" value={formatNumber(major.schoolCount)} />
        <StatCard
          label={`Highest Earning (${earningsKey === 'earn1yr' ? '1yr' : '5yr'})`}
          value={stats.highest ? formatCurrency(stats.highest[stats.highestEarnKey]) : '\u2014'}
          detail={stats.highest?.schoolName}
        />
        <StatCard
          label={`Median (${earningsKey === 'earn1yr' ? '1yr' : '5yr'})`}
          value={formatCurrency(earningsKey === 'earn1yr' ? major.medianEarn1yr : major.medianEarn5yr)}
        />
        <StatCard
          label="Earnings Growth"
          value={formatPercent(major.growthRate)}
        />
      </div>

      {/* Scatter chart */}
      {hasScatterData && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              Earnings vs. Cost &mdash; {allChartData.length} Schools
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
            onClick={(e) => {
              if (dotClickedRef.current) { dotClickedRef.current = false; return; }
              if ((e.target as HTMLElement).closest?.('svg')) setSelectedSchool(null);
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
                  ticks={yTicks}
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
                <ReferenceLine
                  segment={[{ x: 0, y: 0 }, { x: xDomain[1], y: xDomain[1] }]}
                  stroke="#ef4444"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
                {medianLine && (
                  <ReferenceLine
                    y={medianLine}
                    stroke="#6b7280"
                    strokeDasharray="6 4"
                  />
                )}
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
                    className={`flex items-center gap-1.5 text-xs ${hasHighlighted || !hasActiveFilter ? 'text-text-secondary' : 'text-text-secondary/40'}`}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: hasHighlighted || !hasActiveFilter
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
              {medianLine && (
                <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="inline-block h-0 w-4 border-t-[1.5px] border-dashed border-gray-500" />
                  Median ({formatCompact(medianLine)})
                </span>
              )}
            </div>
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

      {/* Comparison panel */}
      {comparedSchools.length >= 2 && (
        <div className="mt-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Comparing {comparedSchools.length} Schools
            </h3>
            <button
              onClick={() => setCompareSet(new Set())}
              className="text-xs text-accent hover:underline"
            >
              Clear
            </button>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${comparedSchools.length}, 1fr)` }}>
            {comparedSchools.map((r) => (
              <div key={r.unitId} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: TIER_COLORS[r.tier] ?? '#9ca3af' }}
                  />
                  <span className="truncate text-xs font-semibold text-text-primary">
                    {r.schoolName}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-text-secondary">{r.state} &middot; {r.tier}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">1yr Earnings</span>
                    <span className="font-medium text-earn-above">{formatCurrency(r.earn1yr)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">5yr Earnings</span>
                    <span className="font-medium text-earn-above">
                      {r.earn5yr != null ? formatCurrency(r.earn5yr) : '\u2014'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Cost</span>
                    <span className="font-medium">{r.cost > 0 ? formatCurrency(r.cost) : '\u2014'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">ROI</span>
                    <span className="font-semibold">{r.multiple > 0 ? r.multiple.toFixed(1) + 'x' : '\u2014'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
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

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            Tier
          </label>
          <div className="flex flex-wrap gap-1">
            {TIER_ORDER.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTierFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(t)) next.delete(t);
                    else next.add(t);
                    return next;
                  });
                  setPage(1);
                }}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  tierFilter.has(t)
                    ? 'bg-accent text-white'
                    : 'border border-gray-200 bg-white text-text-secondary hover:text-text-primary'
                }`}
              >
                {t}
              </button>
            ))}
            {tierFilter.size > 0 && (
              <button
                onClick={() => { setTierFilter(new Set()); setPage(1); }}
                className="rounded-full px-2 py-1 text-xs text-accent hover:bg-accent/10"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filtersActive && (
          <button
            onClick={() => {
              setSearchQuery('');
              setOwnershipFilter(null);
              setStateFilter('');
              setTierFilter(new Set());
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
              <th className="w-8 px-2 py-2 text-center font-medium text-text-secondary">
                <span className="sr-only">Compare</span>
              </th>
              <th className="px-3 py-2 font-medium text-text-secondary">#</th>
              <SortableHeader<SortField>
                label="School"
                sortKey="schoolName"
                currentSortKey={sortField}
                currentSortDir={sortDir}
                onClick={handleSort}
              />
              <SortableHeader<SortField>
                label="1yr Earnings"
                sortKey="earn1yr"
                currentSortKey={sortField}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="text-right"
              />
              <SortableHeader<SortField>
                label="5yr Earnings"
                sortKey="earn5yr"
                currentSortKey={sortField}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="hidden text-right sm:table-cell"
              />
              <SortableHeader<SortField>
                label="Cost"
                sortKey="cost"
                currentSortKey={sortField}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="hidden text-right sm:table-cell"
              />
              <SortableHeader<SortField>
                label="ROI"
                sortKey="multiple"
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
                  selectedSchool === r.unitId
                    ? 'bg-accent/10'
                    : compareSet.has(r.unitId)
                      ? 'bg-accent/5'
                      : 'hover:bg-gray-50'
                }`}
                onClick={() => handleRowClick(r.unitId)}
              >
                <td className="w-8 px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={compareSet.has(r.unitId)}
                    disabled={!compareSet.has(r.unitId) && compareSet.size >= 4}
                    onChange={() => handleCompareToggle(r.unitId)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-accent accent-accent"
                  />
                </td>
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
                  colSpan={9}
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
