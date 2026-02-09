'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  spread: number;
  median5yr: number;
  growthRate: number | null;
  schoolCount: number;
}

function MajorChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: MajorScatterDatum }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-text-primary">{d.cipTitle.replace(/\.+$/, '')}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        <span>Median 5yr: <strong className="text-earn-above">{formatCurrency(d.median5yr)}</strong></span>
        <span>Spread: <strong>{formatCompact(d.spread)}</strong></span>
        <span>Growth: <strong className={d.growthRate != null && d.growthRate > 0 ? 'text-earn-above' : 'text-text-secondary'}>{d.growthRate != null ? `${d.growthRate > 0 ? '+' : ''}${d.growthRate}%` : '\u2014'}</strong></span>
        <span>Schools: <strong>{d.schoolCount}</strong></span>
      </div>
      <span
        className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: CIP_CATEGORY_COLORS[d.category] ?? '#6b7280' }}
      >
        {d.category}
      </span>
    </div>
  );
}

type SortKey = 'cipTitle' | 'medianEarn1yr' | 'medianEarn5yr' | 'growthRate' | 'schoolCount';

const PAGE_SIZE = 25;

interface MajorRankingsProps {
  majorsSummary: MajorSummary[];
}

export default function MajorRankings({ majorsSummary }: MajorRankingsProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('medianEarn5yr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [minSchools, setMinSchools] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());

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
    const withEarn = filtered.filter((m) => m.medianEarn5yr != null);
    const highest = withEarn.length
      ? withEarn.reduce((best, m) =>
          (m.medianEarn5yr ?? 0) > (best.medianEarn5yr ?? 0) ? m : best,
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
    return { total: filtered.length, highest, fastestGrowth };
  }, [filtered]);

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

  // Scatter chart data: 5yr Median Earnings vs Earnings Spread, grouped by category
  const { categoryData, xDomain, yDomain } = useMemo(() => {
    const groups: Record<string, MajorScatterDatum[]> = {};
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const m of filtered) {
      if (m.medianEarn5yr == null || m.p75Earn5yr == null || m.p25Earn5yr == null) continue;
      const spread = m.p75Earn5yr - m.p25Earn5yr;
      if (spread <= 0) continue;
      const category = getCipCategory(m.cipCode);
      if (!groups[category]) groups[category] = [];
      groups[category].push({
        x: m.medianEarn5yr,
        y: spread,
        cipCode: m.cipCode,
        cipTitle: m.cipTitle,
        category,
        spread,
        median5yr: m.medianEarn5yr,
        growthRate: m.growthRate,
        schoolCount: m.schoolCount,
      });
      if (m.medianEarn5yr < minX) minX = m.medianEarn5yr;
      if (m.medianEarn5yr > maxX) maxX = m.medianEarn5yr;
      if (spread < minY) minY = spread;
      if (spread > maxY) maxY = spread;
    }
    const xPad = (maxX - minX) * 0.05 || 5000;
    const yPad = (maxY - minY) * 0.1 || 5000;
    return {
      categoryData: groups,
      xDomain: [Math.max(0, minX - xPad), maxX + xPad] as [number, number],
      yDomain: [Math.max(0, minY - yPad), maxY + yPad] as [number, number],
    };
  }, [filtered]);

  const hasScatterData = Object.keys(categoryData).length > 0;

  const handleDotClick = useCallback((data: any) => {
    const code = data?.cipCode ?? data?.payload?.cipCode;
    if (code != null) {
      trackEvent('major_click', { cipCode: code });
      router.push(`/majors/${encodeURIComponent(code)}?from=majors`);
    }
  }, [router]);

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
          label="Highest Earning Major"
          value={stats.highest ? formatCurrency(stats.highest.medianEarn5yr) : '\u2014'}
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

      {/* Scatter chart: 5yr Median Earnings vs Earnings Spread */}
      {hasScatterData && (
        <div
          className="mb-6 rounded-lg border border-gray-100 bg-white p-2 shadow-sm sm:p-4"
          style={{ userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest?.('svg')) e.preventDefault();
          }}
        >
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="x"
                type="number"
                domain={xDomain}
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                label={{ value: 'Median 5yr Earnings', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                dataKey="y"
                type="number"
                domain={yDomain}
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                width={60}
                label={{ value: 'Earnings Spread (p75 \u2212 p25)', angle: -90, position: 'insideLeft', offset: 5, fontSize: 12, fill: '#6b7280' }}
              />
              <Tooltip content={<MajorChartTooltip />} cursor={false} />
              {CIP_CATEGORY_ORDER.map(
                (cat) =>
                  categoryData[cat] && (
                    <Scatter
                      key={cat}
                      name={cat}
                      data={categoryData[cat]}
                      fill={CIP_CATEGORY_COLORS[cat]}
                      fillOpacity={0.75}
                      onClick={handleDotClick}
                    />
                  ),
              )}
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {CIP_CATEGORY_ORDER.map((cat) =>
              categoryData[cat] ? (
                <span key={cat} className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: CIP_CATEGORY_COLORS[cat] }}
                  />
                  {cat}
                </span>
              ) : null,
            )}
          </div>
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
                      style={{ backgroundColor: CIP_CATEGORY_COLORS[category] ?? '#6b7280' }}
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

      {/* Controls: search + min schools */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-text-secondary">
            Category
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
          >
            <option value="">All</option>
            {CIP_CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <label className="text-xs font-medium text-text-secondary">
            Min schools
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
          <span className="text-xs text-text-secondary">
            {filtered.length} of {majorsSummary.length} majors
            {compareSet.size > 0 && (
              <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-accent">
                {compareSet.size}/4 selected
              </span>
            )}
          </span>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search majors..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 pr-7 text-xs text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-accent sm:w-56"
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
                onClick={() => { trackEvent('major_click', { cipCode: m.cipCode }); router.push(`/majors/${encodeURIComponent(m.cipCode)}?from=majors`); }}
                className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50"
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
                <td className="px-3 py-2.5 text-sm font-medium text-text-primary">
                  {m.cipTitle.replace(/\.+$/, '')}
                  <span className="ml-2 text-xs text-accent">&rarr;</span>
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
