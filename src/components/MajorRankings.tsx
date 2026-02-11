'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';
import type { MajorSummary, SortDir } from '@/types';
import StatCard from './StatCard';
import SortableHeader from './SortableHeader';
import { formatCurrency, formatCompact, formatPercent, formatNumber } from '@/lib/formatters';
import { getCipCategory, CIP_CATEGORY_COLORS, CIP_CATEGORY_ORDER } from '@/lib/cip-categories';
import { trackEvent } from '@/lib/analytics';

interface MajorScatterDatum {
  x: number;
  y: number;
  cipCode: string;
  cipTitle: string;
  category: string;
  median1yr: number;
  median5yr: number;
  growthRate: number;
  schoolCount: number;
}

function MajorChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: MajorScatterDatum }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-text-primary">{d.cipTitle.replace(/\.+$/, '')}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        <span>Median 1yr: <strong className="text-earn-above">{formatCurrency(d.median1yr)}</strong></span>
        <span>Median 5yr: <strong className="text-earn-above">{formatCurrency(d.median5yr)}</strong></span>
        <span>Growth: <strong className={d.growthRate > 0 ? 'text-earn-above' : 'text-text-secondary'}>{d.growthRate > 0 ? '+' : ''}{d.growthRate}%</strong></span>
        <span>Schools: <strong>{d.schoolCount}</strong></span>
      </div>
      <span
        className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: CIP_CATEGORY_COLORS[d.category] ?? '#475569' }}
      >
        {d.category}
      </span>
      <p className="mt-1.5 text-[10px] text-text-secondary">Click to see details</p>
    </div>
  );
}

type SortKey = 'cipTitle' | 'medianEarn1yr' | 'medianEarn5yr' | 'growthRate' | 'schoolCount';

const PAGE_SIZE = 25;

interface MajorRankingsProps {
  majorsSummary: MajorSummary[];
}

export default function MajorRankings({ majorsSummary }: MajorRankingsProps) {
  const [sortKey, setSortKey] = useState<SortKey>('medianEarn1yr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [minSchools, setMinSchools] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());
  const [chartEarnings, setChartEarnings] = useState<'earn1yr' | 'earn5yr'>('earn1yr');
  const [selectedMajor, setSelectedMajor] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Close detail card on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedMajor(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'cipTitle' ? 'asc' : 'desc');
    }
    setPage(1);
  }, [sortKey]);

  // Filter only (no sort) — chart + stats depend on this
  const filtered = useMemo(() => {
    let arr = majorsSummary.filter((m) => m.schoolCount >= minSchools);
    if (categoryFilter) {
      arr = arr.filter((m) => getCipCategory(m.cipCode) === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      arr = arr.filter((m) => m.cipTitle.toLowerCase().includes(q));
    }
    return arr;
  }, [majorsSummary, minSchools, categoryFilter, searchQuery]);

  // Sort separately so chart doesn't re-render on sort change
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      if (sortKey === 'cipTitle') {
        aVal = a.cipTitle;
        bVal = b.cipTitle;
      } else {
        aVal = a[sortKey];
        bVal = b[sortKey];
      }

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const cmp =
        typeof aVal === 'string'
          ? aVal.localeCompare(bVal as string)
          : (aVal as number) - (bVal as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const stats = useMemo(() => {
    const earnKey: 'medianEarn1yr' | 'medianEarn5yr' = chartEarnings === 'earn1yr' ? 'medianEarn1yr' : 'medianEarn5yr';
    const withEarn = filtered.filter((m) => m[earnKey] != null);
    const highest = withEarn.length
      ? withEarn.reduce((best, m) =>
          (m[earnKey] ?? 0) > (best[earnKey] ?? 0) ? m : best,
          withEarn[0],
        )
      : null;
    const withGrowth = filtered.filter((m) => m.growthRate != null);
    const fastestGrowth = withGrowth.length
      ? withGrowth.reduce((best, m) =>
          (m.growthRate ?? 0) > (best.growthRate ?? 0) ? m : best,
          withGrowth[0],
        )
      : null;
    return { total: filtered.length, highest, highestEarnKey: earnKey, fastestGrowth };
  }, [filtered, chartEarnings]);

  // Comparison
  const comparedMajors = useMemo(() => {
    if (compareSet.size === 0) return [];
    return filtered.filter((m) => compareSet.has(m.cipCode));
  }, [filtered, compareSet]);

  const handleCompareToggle = useCallback((cipCode: string) => {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(cipCode)) {
        next.delete(cipCode);
      } else if (next.size < 4) {
        next.add(cipCode);
      }
      return next;
    });
  }, []);

  // Scatter chart: always show all qualifying data; dim non-matching points
  const earningsField = chartEarnings === 'earn1yr' ? 'medianEarn1yr' : 'medianEarn5yr';
  const hasActiveFilter = !!(searchQuery.trim() || categoryFilter || compareSet.size > 0);

  // Base chart data: minSchools filter only (axes stay stable)
  const { allChartData, xDomain, yDomain } = useMemo(() => {
    const all: MajorScatterDatum[] = [];
    let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const m of majorsSummary) {
      if (m.schoolCount < minSchools) continue;
      if (m.growthRate == null || m[earningsField] == null || m.medianEarn1yr == null || m.medianEarn5yr == null) continue;
      const earnings = m[earningsField]!;
      all.push({
        x: m.growthRate,
        y: earnings,
        cipCode: m.cipCode,
        cipTitle: m.cipTitle,
        category: getCipCategory(m.cipCode),
        median1yr: m.medianEarn1yr,
        median5yr: m.medianEarn5yr,
        growthRate: m.growthRate,
        schoolCount: m.schoolCount,
      });
      if (m.growthRate < minX) minX = m.growthRate;
      if (m.growthRate > maxX) maxX = m.growthRate;
      if (earnings > maxY) maxY = earnings;
    }
    const xLo = Math.min(0, minX);
    const xHi = Math.max(0, maxX);
    const xPad = (xHi - xLo) * 0.05 || 5;
    return {
      allChartData: all,
      xDomain: [xLo - xPad, xHi + xPad] as [number, number],
      yDomain: [0, 125000] as [number, number],
    };
  }, [majorsSummary, minSchools, earningsField]);

  // Split into dimmed (background) and highlighted (foreground) by category
  // Compare selection takes priority; otherwise use search/category filter
  const { dimmedData, highlightedByCategory } = useMemo(() => {
    if (!hasActiveFilter) {
      // No filter active — all points colored by category, nothing dimmed
      const groups: Record<string, MajorScatterDatum[]> = {};
      for (const d of allChartData) {
        if (!groups[d.category]) groups[d.category] = [];
        groups[d.category].push(d);
      }
      return { dimmedData: [] as MajorScatterDatum[], highlightedByCategory: groups };
    }
    // Compare takes priority over search/category
    const highlightCodes = compareSet.size > 0
      ? compareSet
      : new Set(filtered.map((m) => m.cipCode));
    const dimmed: MajorScatterDatum[] = [];
    const groups: Record<string, MajorScatterDatum[]> = {};
    for (const d of allChartData) {
      if (highlightCodes.has(d.cipCode)) {
        if (!groups[d.category]) groups[d.category] = [];
        groups[d.category].push(d);
      } else {
        dimmed.push(d);
      }
    }
    return { dimmedData: dimmed, highlightedByCategory: groups };
  }, [allChartData, filtered, compareSet, hasActiveFilter]);

  const hasScatterData = allChartData.length > 0;

  const handleDotClick = useCallback((data: any) => {
    const code = data?.cipCode ?? data?.payload?.cipCode;
    if (code != null) {
      trackEvent('major_click', { cipCode: code });
      setSelectedMajor((prev) => (prev === code ? null : code));
    }
  }, []);

  const selectedMajorData = useMemo(() => {
    if (!selectedMajor) return null;
    return allChartData.find((d) => d.cipCode === selectedMajor) ?? null;
  }, [selectedMajor, allChartData]);

  // Custom dot shape — highlights selected major
  const renderDot = useCallback(
    (props: any) => {
      const { cx, cy, fill, payload } = props;
      if (cx == null || cy == null) return <circle cx={0} cy={0} r={0} />;
      const code = payload?.cipCode;
      const isSelected = code != null && code === selectedMajor;
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
    [selectedMajor],
  );

  const handleRowClick = useCallback((cipCode: string) => {
    setSelectedMajor((prev) => (prev === cipCode ? null : cipCode));
    chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  // Reset page when filters change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const handleMinSchoolsChange = useCallback((value: number) => {
    setMinSchools(value);
    setPage(1);
  }, []);

  const handleCategoryChange = useCallback((value: string) => {
    setCategoryFilter(value);
    setPage(1);
  }, []);

  // Generate page numbers to show
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="mt-6">
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total Majors" value={formatNumber(stats.total)} />
        <StatCard
          label={`Highest Earning (${chartEarnings === 'earn1yr' ? '1yr' : '5yr'})`}
          value={stats.highest ? formatCurrency(stats.highest[stats.highestEarnKey]) : '\u2014'}
          detail={stats.highest?.cipTitle.replace(/\.+$/, '')}
        />
        <StatCard
          label="Fastest Growing Major"
          value={
            stats.fastestGrowth
              ? formatPercent(stats.fastestGrowth.growthRate)
              : '\u2014'
          }
          detail={stats.fastestGrowth?.cipTitle.replace(/\.+$/, '')}
          detailColor="text-earn-above"
        />
      </div>

      {/* Scatter chart: Earnings vs Growth Rate */}
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
            <span className="text-xs font-medium text-text-secondary">
              Earnings vs Growth Rate
            </span>
            <div className="flex rounded-lg border border-gray-200 text-xs">
              <button
                onClick={() => setChartEarnings('earn1yr')}
                className={`px-3 py-1.5 transition-colors rounded-l-lg ${
                  chartEarnings === 'earn1yr'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                1-Year
              </button>
              <button
                onClick={() => setChartEarnings('earn5yr')}
                className={`px-3 py-1.5 transition-colors rounded-r-lg ${
                  chartEarnings === 'earn5yr'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                5-Year
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="x"
                type="number"
                domain={xDomain}
                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}%`}
                tick={{ fontSize: 11, fill: '#475569' }}
                label={{ value: 'Earnings Growth (1yr \u2192 5yr)', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#475569' }}
              />
              <YAxis
                dataKey="y"
                type="number"
                domain={yDomain}
                ticks={[0, 25000, 50000, 75000, 100000, 125000]}
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fontSize: 11, fill: '#475569' }}
                width={60}
                label={{ value: chartEarnings === 'earn1yr' ? 'Median 1yr Earnings' : 'Median 5yr Earnings', angle: -90, position: 'insideLeft', offset: 5, fontSize: 12, fill: '#475569' }}
              />
              <Tooltip content={<MajorChartTooltip />} cursor={false} />
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
              {/* Highlighted points by category — reverse so top categories render last (on top) */}
              {[...CIP_CATEGORY_ORDER].reverse().map(
                (cat) =>
                  highlightedByCategory[cat] && (
                    <Scatter
                      key={cat}
                      name={cat}
                      data={highlightedByCategory[cat]}
                      fill={CIP_CATEGORY_COLORS[cat]}
                      fillOpacity={0.75}
                      shape={renderDot}
                      onClick={handleDotClick}
                    />
                  ),
              )}
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {CIP_CATEGORY_ORDER.map((cat) => {
              const hasHighlighted = !!highlightedByCategory[cat];
              return (
                <span
                  key={cat}
                  className={`flex items-center gap-1.5 text-xs ${hasHighlighted || !hasActiveFilter ? 'text-text-secondary' : 'text-text-secondary/40'}`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: hasHighlighted || !hasActiveFilter
                        ? CIP_CATEGORY_COLORS[cat]
                        : '#d1d5db',
                    }}
                  />
                  {cat}
                </span>
              );
            })}
          </div>

          {/* Detail card — shown when a major dot is selected */}
          {selectedMajorData && (
            <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: CIP_CATEGORY_COLORS[selectedMajorData.category] ?? '#475569' }}
                    />
                    <span className="truncate text-base font-semibold text-text-primary">
                      {selectedMajorData.cipTitle.replace(/\.+$/, '')}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {selectedMajorData.category} &middot; {selectedMajorData.schoolCount} schools
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMajor(null)}
                  className="rounded-lg px-2 py-1 text-lg text-text-secondary hover:text-text-primary"
                >
                  &times;
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">Median 1yr</p>
                  <p className="text-sm font-semibold text-earn-above">{formatCurrency(selectedMajorData.median1yr)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">Median 5yr</p>
                  <p className="text-sm font-semibold text-earn-above">{formatCurrency(selectedMajorData.median5yr)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">Growth</p>
                  <p className="text-sm font-semibold">
                    {selectedMajorData.growthRate > 0 ? '+' : ''}{selectedMajorData.growthRate}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">Schools</p>
                  <p className="text-sm font-semibold">{selectedMajorData.schoolCount}</p>
                </div>
              </div>

              <Link
                href={`/majors/${encodeURIComponent(selectedMajorData.cipCode)}?from=majors`}
                className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
              >
                View major details &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Comparison panel */}
      {comparedMajors.length >= 2 && (
        <div className="mb-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Comparing {comparedMajors.length} Majors
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
              comparedMajors.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : comparedMajors.length === 3
                  ? 'grid-cols-1 sm:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}
          >
            {comparedMajors.map((m) => {
              const category = getCipCategory(m.cipCode);
              return (
                <div key={m.cipCode} className="rounded-lg border border-gray-100 p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: CIP_CATEGORY_COLORS[category] ?? '#475569' }}
                    />
                    <Link
                      href={`/majors/${encodeURIComponent(m.cipCode)}?from=majors`}
                      className="truncate text-sm font-semibold text-accent hover:underline"
                    >
                      {m.cipTitle.replace(/\.+$/, '')}
                    </Link>
                  </div>
                  <p className="mb-2 text-xs text-text-secondary">{category}</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Median 1yr</span>
                      <span className="font-medium text-earn-above">{formatCurrency(m.medianEarn1yr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Median 5yr</span>
                      <span className="font-medium text-earn-above">{formatCurrency(m.medianEarn5yr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Growth</span>
                      <span className={`font-medium ${(m.growthRate ?? 0) > 0 ? 'text-earn-above' : 'text-text-secondary'}`}>
                        {m.growthRate != null ? `${m.growthRate > 0 ? '+' : ''}${m.growthRate}%` : '\u2014'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Schools</span>
                      <span>{formatNumber(m.schoolCount)}</span>
                    </div>
                    <hr className="border-gray-100" />
                    <div className="flex justify-between">
                      <span className="text-text-secondary">1yr Range</span>
                      <span>{formatCurrency(m.p25Earn1yr)}&ndash;{formatCurrency(m.p75Earn1yr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">5yr Range</span>
                      <span>{formatCurrency(m.p25Earn5yr)}&ndash;{formatCurrency(m.p75Earn5yr)}</span>
                    </div>
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
            Search Majors
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Major name..."
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
            Category
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
          >
            <option value="">All Categories</option>
            {CIP_CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            Min Schools
          </label>
          <select
            value={minSchools}
            onChange={(e) => handleMinSchoolsChange(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
          >
            {[1, 5, 10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </div>

        {(searchQuery || categoryFilter) && (
          <button
            onClick={() => {
              handleSearchChange('');
              handleCategoryChange('');
            }}
            className="rounded-lg px-2 py-1.5 text-xs text-accent hover:bg-accent/10"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Count */}
      <p className="mb-2 text-xs text-text-secondary">
        {filtered.length} of {majorsSummary.length} majors
        {compareSet.size > 0 && (
          <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-accent">
            {compareSet.size}/4 selected
          </span>
        )}
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-left">
          <thead className="border-b border-gray-100 bg-gray-50/50">
            <tr>
              <th className="w-10 px-2 py-2.5" />
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-text-secondary w-10">#</th>
              <SortableHeader<SortKey>
                label="Major"
                sortKey="cipTitle"
                currentSortKey={sortKey}
                currentSortDir={sortDir}
                onClick={handleSort}
              />
              <SortableHeader<SortKey>
                label="Median 5yr"
                sortKey="medianEarn5yr"
                currentSortKey={sortKey}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="text-right"
              />
              <SortableHeader<SortKey>
                label="Median 1yr"
                sortKey="medianEarn1yr"
                currentSortKey={sortKey}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="hidden text-right sm:table-cell"
              />
              <SortableHeader<SortKey>
                label="Growth"
                sortKey="growthRate"
                currentSortKey={sortKey}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="hidden text-right sm:table-cell"
              />
              <SortableHeader<SortKey>
                label="Schools"
                sortKey="schoolCount"
                currentSortKey={sortKey}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="hidden text-right md:table-cell"
              />
            </tr>
          </thead>
          <tbody>
            {paginated.map((m, i) => (
              <tr
                key={m.cipCode}
                onClick={() => handleRowClick(m.cipCode)}
                className={`cursor-pointer border-b border-gray-50 transition-colors ${
                  selectedMajor === m.cipCode
                    ? 'bg-accent/10'
                    : 'hover:bg-gray-50'
                }`}
              >
                <td
                  className="w-10 px-2 py-2.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={compareSet.has(m.cipCode)}
                    onChange={() => handleCompareToggle(m.cipCode)}
                    disabled={!compareSet.has(m.cipCode) && compareSet.size >= 4}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-accent accent-accent"
                  />
                </td>
                <td className="px-3 py-2.5 text-right text-xs tabular-nums text-text-secondary w-10">
                  {(currentPage - 1) * PAGE_SIZE + i + 1}
                </td>
                <td className="px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: CIP_CATEGORY_COLORS[getCipCategory(m.cipCode)] ?? '#475569' }}
                    />
                    <Link
                      href={`/majors/${encodeURIComponent(m.cipCode)}?from=majors`}
                      className="font-medium text-accent hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {m.cipTitle.replace(/\.+$/, '')}
                    </Link>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums text-text-primary">
                  {formatCurrency(m.medianEarn5yr)}
                </td>
                <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-text-primary sm:table-cell">
                  {formatCurrency(m.medianEarn1yr)}
                </td>
                <td
                  className={`hidden px-3 py-2.5 text-right text-sm tabular-nums sm:table-cell ${
                    (m.growthRate ?? 0) > 0
                      ? 'text-earn-above'
                      : 'text-text-secondary'
                  }`}
                >
                  {formatPercent(m.growthRate)}
                </td>
                <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-text-secondary md:table-cell">
                  {formatNumber(m.schoolCount)}
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-sm text-text-secondary"
                >
                  No majors match your search
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
                  <span className="px-1 text-xs text-text-secondary">&hellip;</span>
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
                  <span className="px-1 text-xs text-text-secondary">&hellip;</span>
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
