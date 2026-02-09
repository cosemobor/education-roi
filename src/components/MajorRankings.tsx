'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { MajorSummary, SortDir } from '@/types';
import StatCard from './StatCard';
import SortableHeader from './SortableHeader';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/formatters';

type SortKey = 'cipTitle' | 'medianEarn1yr' | 'medianEarn5yr' | 'growthRate' | 'schoolCount';

const PAGE_SIZE = 25;

interface MajorRankingsProps {
  majorsSummary: MajorSummary[];
}

export default function MajorRankings({ majorsSummary }: MajorRankingsProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('medianEarn1yr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [minSchools, setMinSchools] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('desc');
      return key;
    });
    setPage(1);
  }, []);

  // Filter by min schools, then search, then sort
  const filtered = useMemo(() => {
    let arr = majorsSummary.filter((m) => m.schoolCount >= minSchools);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      arr = arr.filter((m) => m.cipTitle.toLowerCase().includes(q));
    }
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
  }, [majorsSummary, sortKey, sortDir, minSchools, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const stats = useMemo(() => {
    const withEarn = filtered.filter((m) => m.medianEarn1yr != null);
    const highest = withEarn.length
      ? withEarn.reduce((best, m) =>
          (m.medianEarn1yr ?? 0) > (best.medianEarn1yr ?? 0) ? m : best,
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

  // Reset page when filters change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const handleMinSchoolsChange = useCallback((value: number) => {
    setMinSchools(value);
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
          value={stats.highest ? formatCurrency(stats.highest.medianEarn1yr) : '\u2014'}
          detail={stats.highest?.cipTitle}
        />
        <StatCard
          label="Fastest Growing Major"
          value={
            stats.fastestGrowth
              ? formatPercent(stats.fastestGrowth.growthRate)
              : '\u2014'
          }
          detail={stats.fastestGrowth?.cipTitle}
          detailColor="text-earn-above"
        />
      </div>

      {/* Controls: search + min schools */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
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
              <SortableHeader<SortKey>
                label="Major"
                sortKey="cipTitle"
                currentSortKey={sortKey}
                currentSortDir={sortDir}
                onClick={handleSort}
              />
              <SortableHeader<SortKey>
                label="Median 1yr"
                sortKey="medianEarn1yr"
                currentSortKey={sortKey}
                currentSortDir={sortDir}
                onClick={handleSort}
                className="text-right"
              />
              <SortableHeader<SortKey>
                label="Median 5yr"
                sortKey="medianEarn5yr"
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
            {paginated.map((m) => (
              <tr
                key={m.cipCode}
                onClick={() => router.push(`/majors/${encodeURIComponent(m.cipCode)}`)}
                className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50"
              >
                <td className="px-3 py-2.5 text-sm font-medium text-text-primary">
                  {m.cipTitle}
                  <span className="ml-2 text-xs text-accent">&rarr;</span>
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums text-text-primary">
                  {formatCurrency(m.medianEarn1yr)}
                </td>
                <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-text-primary sm:table-cell">
                  {formatCurrency(m.medianEarn5yr)}
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
                  colSpan={5}
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
