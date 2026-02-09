'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { SchoolRanking, SortDir } from '@/types';
import { formatCurrency, formatRate, formatNumber } from '@/lib/formatters';
import { getDisplayTier, TIER_COLORS } from '@/lib/tiers';
import StatCard from './StatCard';

type SortField =
  | 'name'
  | 'weightedEarn1yr'
  | 'roi'
  | 'programCount'
  | 'admissionRate'
  | 'costAttendance';

const PAGE_SIZE = 25;

const EARN_THRESHOLDS = [
  { value: 0, label: 'All' },
  { value: 40000, label: '$40k+' },
  { value: 50000, label: '$50k+' },
  { value: 60000, label: '$60k+' },
  { value: 75000, label: '$75k+' },
  { value: 100000, label: '$100k+' },
];

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
  const [earnThreshold, setEarnThreshold] = useState(0);
  const [minPrograms, setMinPrograms] = useState(10);
  const [page, setPage] = useState(1);

  const states = useMemo(() => {
    const s = new Set(schoolRankings.map((r) => r.state).filter(Boolean));
    return Array.from(s).sort();
  }, [schoolRankings]);

  // Filter
  const filtered = useMemo(() => {
    let rows = schoolRankings.filter((r) => r.programCount >= minPrograms);
    if (earnThreshold > 0) {
      rows = rows.filter(
        (r) => r.weightedEarn1yr != null && r.weightedEarn1yr >= earnThreshold,
      );
    }
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
  }, [schoolRankings, searchQuery, ownershipFilter, stateFilter, earnThreshold, minPrograms]);

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
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(field === 'name' ? 'asc' : 'desc');
      return field;
    });
    setPage(1);
  }, []);

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
    const withEarn = filtered.filter((r) => r.weightedEarn1yr != null);
    const highest = withEarn.length
      ? withEarn.reduce((best, r) =>
          (r.weightedEarn1yr ?? 0) > (best.weightedEarn1yr ?? 0) ? r : best,
          withEarn[0],
        )
      : null;
    const bestRoi = withEarn.length
      ? withEarn.reduce((best, r) =>
          (r.roi ?? 0) > (best.roi ?? 0) ? r : best,
          withEarn[0],
        )
      : null;
    return { total: filtered.length, highest, bestRoi };
  }, [filtered]);

  const filtersActive = !!(
    searchQuery ||
    ownershipFilter != null ||
    stateFilter ||
    earnThreshold > 0
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
          value={
            stats.bestRoi?.roi != null
              ? stats.bestRoi.roi.toFixed(1) + 'x'
              : '\u2014'
          }
          detail={stats.bestRoi?.name}
        />
      </div>

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
            Min Median Earnings
          </label>
          <div className="flex rounded-lg border border-gray-200 bg-white text-xs">
            {EARN_THRESHOLDS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => {
                  setEarnThreshold(value);
                  setPage(1);
                }}
                className={`px-2 py-1.5 transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  earnThreshold === value
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
              setEarnThreshold(0);
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
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-left">
          <thead className="border-b border-gray-100 bg-gray-50/50">
            <tr>
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
                onClick={() => handleSort('weightedEarn1yr')}
              >
                Avg 1yr{sortArrow('weightedEarn1yr')}
              </th>
              <th
                className="cursor-pointer px-3 py-2 text-right text-xs font-medium text-text-secondary hover:text-text-primary"
                onClick={() => handleSort('roi')}
              >
                ROI{sortArrow('roi')}
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
                        href={`/schools/${r.unitId}`}
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
                    {formatCurrency(r.weightedEarn1yr)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums font-semibold text-text-primary">
                    {r.roi != null ? r.roi.toFixed(1) + 'x' : '\u2014'}
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
                  colSpan={8}
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
