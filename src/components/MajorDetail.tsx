'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { MajorSummary, ProgramRecord, SortDir } from '@/types';
import { formatCurrency, formatRate, formatNumber, formatPercent } from '@/lib/formatters';
import { getDisplayTier, TIER_COLORS } from '@/lib/tiers';
import { generateMajorDescription } from '@/lib/descriptions';
import StatCard from './StatCard';

type SortField = 'schoolName' | 'earn1yr' | 'earn5yr' | 'cost' | 'multiple' | 'admissionRate';

const PAGE_SIZE = 25;

interface MajorDetailProps {
  major: MajorSummary;
  programs: ProgramRecord[];
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

export default function MajorDetail({ major, programs }: MajorDetailProps) {
  const [sortField, setSortField] = useState<SortField>('earn1yr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<number | null>(null);
  const [stateFilter, setStateFilter] = useState('');
  const [page, setPage] = useState(1);

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
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(field === 'schoolName' ? 'asc' : 'desc');
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
        href="/"
        className="mb-4 inline-block text-sm text-accent hover:underline"
      >
        &larr; All Majors
      </Link>
      <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
        {major.cipTitle}
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
                className="border-t border-gray-50 transition-colors hover:bg-gray-50"
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
                      href={`/schools/${r.unitId}`}
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
