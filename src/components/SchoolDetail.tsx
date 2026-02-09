'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { School, ProgramRecord, SortDir } from '@/types';
import { formatCurrency, formatRate, formatNumber } from '@/lib/formatters';
import { getDisplayTier, TIER_COLORS } from '@/lib/tiers';
import { generateSchoolDescription } from '@/lib/descriptions';
import StatCard from './StatCard';

type SortField = 'cipTitle' | 'earn1yr' | 'earn5yr' | 'costAttendance' | 'multiple' | 'credTitle';

const PAGE_SIZE = 25;

interface SchoolDetailProps {
  school: School;
  programs: ProgramRecord[];
}

interface ProgramRow {
  rank: number;
  cipCode: string;
  cipTitle: string;
  credLevel: number;
  credTitle: string;
  earn1yr: number | null;
  earn5yr: number | null;
  costAttendance: number | null;
  multiple: number;
  earn1yrCount: number | null;
}

export default function SchoolDetail({ school, programs }: SchoolDetailProps) {
  const [sortField, setSortField] = useState<SortField>('earn1yr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [credFilter, setCredFilter] = useState('');
  const [page, setPage] = useState(1);

  const tier = getDisplayTier(school.name, school.selectivityTier);
  const satCombined =
    school.satMath75 != null && school.satRead75 != null
      ? school.satMath75 + school.satRead75
      : null;

  // Build rows from programs
  const allRows = useMemo(() => {
    return programs
      .filter((p) => p.earn1yr != null || p.earn5yr != null)
      .map((p) => ({
        rank: 0,
        cipCode: p.cipCode,
        cipTitle: p.cipTitle,
        credLevel: p.credLevel,
        credTitle: p.credTitle,
        earn1yr: p.earn1yr,
        earn5yr: p.earn5yr,
        costAttendance: p.costAttendance,
        multiple:
          p.costAttendance && p.earn1yr ? p.earn1yr / p.costAttendance : 0,
        earn1yrCount: p.earn1yrCount,
      }));
  }, [programs]);

  // Unique credential levels for filter
  const credOptions = useMemo(() => {
    const map = new Map<string, string>();
    programs.forEach((p) => {
      if (p.credTitle && !map.has(p.credTitle)) {
        map.set(p.credTitle, p.credTitle);
      }
    });
    return Array.from(map.values()).sort();
  }, [programs]);

  // Filter
  const filtered = useMemo(() => {
    let rows = allRows;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) => r.cipTitle.toLowerCase().includes(q));
    }
    if (credFilter) {
      rows = rows.filter((r) => r.credTitle === credFilter);
    }
    return rows;
  }, [allRows, searchQuery, credFilter]);

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
      setSortDir(field === 'cipTitle' || field === 'credTitle' ? 'asc' : 'desc');
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

  // Page numbers
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const filtersActive = !!(searchQuery || credFilter);

  return (
    <div>
      {/* Back link + title */}
      <Link
        href="/"
        className="mb-4 inline-block text-sm text-accent hover:underline"
      >
        &larr; Back
      </Link>
      <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
        {school.name}
      </h1>
      <p className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: TIER_COLORS[tier] ?? '#9ca3af' }}
        />
        {school.city}, {school.state} &middot; {school.ownershipLabel || 'Unknown'} &middot; {tier}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">
        {generateSchoolDescription(school, allRows.length)}
      </p>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Admission Rate"
          value={formatRate(school.admissionRate)}
        />
        <StatCard
          label="SAT Combined (75th)"
          value={satCombined != null ? formatNumber(satCombined) : '\u2014'}
        />
        <StatCard
          label="Enrollment"
          value={school.size != null ? formatNumber(school.size) : '\u2014'}
        />
        <StatCard
          label="Completion Rate"
          value={formatRate(school.completionRate)}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Cost of Attendance"
          value={formatCurrency(school.costAttendance)}
        />
        <StatCard
          label="In-State Tuition"
          value={formatCurrency(school.tuitionInState)}
        />
        <StatCard
          label="Out-of-State Tuition"
          value={formatCurrency(school.tuitionOutState)}
        />
        <StatCard
          label="Programs"
          value={formatNumber(programs.length)}
        />
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
        <div className="flex-1 sm:flex-none">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            Search Programs
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Program name..."
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

        {credOptions.length > 1 && (
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-secondary">
              Credential
            </label>
            <select
              value={credFilter}
              onChange={(e) => {
                setCredFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
            >
              <option value="">All Credentials</option>
              {credOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        {filtersActive && (
          <button
            onClick={() => {
              setSearchQuery('');
              setCredFilter('');
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
                onClick={() => handleSort('cipTitle')}
              >
                Program{sortArrow('cipTitle')}
              </th>
              <th
                className="hidden cursor-pointer px-3 py-2 font-medium text-text-secondary hover:text-text-primary sm:table-cell"
                onClick={() => handleSort('credTitle')}
              >
                Credential{sortArrow('credTitle')}
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
                className="hidden cursor-pointer px-3 py-2 text-right font-medium text-text-secondary hover:text-text-primary md:table-cell"
                onClick={() => handleSort('costAttendance')}
              >
                Cost{sortArrow('costAttendance')}
              </th>
              <th
                className="cursor-pointer px-3 py-2 text-right font-medium text-text-secondary hover:text-text-primary"
                onClick={() => handleSort('multiple')}
              >
                ROI{sortArrow('multiple')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r) => (
              <tr
                key={`${r.cipCode}-${r.credLevel}`}
                className="border-t border-gray-50 transition-colors hover:bg-gray-50"
              >
                <td className="px-3 py-2 text-text-secondary">{r.rank}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/majors/${encodeURIComponent(r.cipCode)}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {r.cipTitle}
                  </Link>
                  <span className="ml-1.5 text-text-secondary sm:hidden">
                    {r.credTitle}
                  </span>
                </td>
                <td className="hidden px-3 py-2 text-text-secondary sm:table-cell">
                  {r.credTitle}
                </td>
                <td className="px-3 py-2 text-right font-medium text-earn-above">
                  {formatCurrency(r.earn1yr)}
                </td>
                <td className="hidden px-3 py-2 text-right font-medium text-earn-above sm:table-cell">
                  {r.earn5yr != null ? formatCurrency(r.earn5yr) : '\u2014'}
                </td>
                <td className="hidden px-3 py-2 text-right text-text-secondary md:table-cell">
                  {r.costAttendance != null && r.costAttendance > 0
                    ? formatCurrency(r.costAttendance)
                    : '\u2014'}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-text-primary">
                  {r.multiple > 0 ? r.multiple.toFixed(1) + 'x' : '\u2014'}
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td
                  colSpan={7}
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
