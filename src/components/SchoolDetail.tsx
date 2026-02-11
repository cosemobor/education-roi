'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { School, ProgramRecord, SortDir } from '@/types';
import { formatCurrency, formatRate, formatNumber, formatCompact } from '@/lib/formatters';
import { getDisplayTier, TIER_COLORS } from '@/lib/tiers';
import { generateSchoolDescription } from '@/lib/descriptions';
import { getCipCategory, CIP_CATEGORY_COLORS, CIP_CATEGORY_ORDER } from '@/lib/cip-categories';
import StatCard from './StatCard';
import ShareButton from './ShareButton';

type SortField = 'cipTitle' | 'earn1yr' | 'earn5yr' | 'costAttendance' | 'multiple' | 'credTitle';

const PAGE_SIZE = 25;

interface DotDatum {
  x: number;
  y: number;
  progKey: string;
  cipCode: string;
  cipTitle: string;
  credTitle: string;
  category: string;
  earn1yr: number | null;
  earn5yr: number | null;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DotDatum }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-text-primary">{d.cipTitle.replace(/\.+$/, '')}</p>
      <p className="text-xs text-text-secondary">{d.credTitle}</p>
      <div className="mt-1.5 flex gap-4 text-xs">
        <span>1yr: <strong className="text-earn-above">{d.earn1yr != null ? formatCurrency(d.earn1yr) : '\u2014'}</strong></span>
        <span>5yr: <strong className="text-earn-above">{d.earn5yr != null ? formatCurrency(d.earn5yr) : '\u2014'}</strong></span>
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

interface SchoolDetailProps {
  school: School;
  programs: ProgramRecord[];
  fromTab?: string;
}

interface ProgramRow {
  rank: number;
  progKey: string;
  cipCode: string;
  cipTitle: string;
  credLevel: number;
  credTitle: string;
  category: string;
  earn1yr: number | null;
  earn5yr: number | null;
  costAttendance: number | null;
  multiple: number;
  earn1yrCount: number | null;
}

export default function SchoolDetail({ school, programs, fromTab }: SchoolDetailProps) {
  const [sortField, setSortField] = useState<SortField>('earn1yr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [credFilter, setCredFilter] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());
  const chartRef = useRef<HTMLDivElement>(null);
  const dotClickedRef = useRef(false);

  const tier = getDisplayTier(school.name, school.selectivityTier, school.admissionRate, school.size);
  const satCombined =
    school.satMath75 != null && school.satRead75 != null
      ? school.satMath75 + school.satRead75
      : null;

  // Close detail card on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedProgram(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Build rows from programs
  const allRows = useMemo(() => {
    return programs
      .filter((p) => p.earn1yr != null || p.earn5yr != null)
      .map((p) => ({
        rank: 0,
        progKey: `${p.cipCode}-${p.credLevel}`,
        cipCode: p.cipCode,
        cipTitle: p.cipTitle,
        credLevel: p.credLevel,
        credTitle: p.credTitle,
        category: getCipCategory(p.cipCode),
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
    if (credFilter.size > 0) {
      rows = rows.filter((r) => credFilter.has(r.credTitle));
    }
    return rows;
  }, [allRows, searchQuery, credFilter]);

  // Static axes — symmetric since both axes are earnings
  const { xDomain, yDomain, xTicks, yTicks } = useMemo(() => {
    let maxVal = 0;
    for (const r of allRows) {
      if (r.earn1yr != null && r.earn1yr > maxVal) maxVal = r.earn1yr;
      if (r.earn5yr != null && r.earn5yr > maxVal) maxVal = r.earn5yr;
    }
    const axisMax = Math.max(75000, Math.ceil(maxVal / 25000) * 25000);
    const ticks = Array.from({ length: axisMax / 25000 + 1 }, (_, i) => i * 25000);
    return {
      xDomain: [0, axisMax] as [number, number],
      yDomain: [0, axisMax] as [number, number],
      xTicks: ticks,
      yTicks: ticks,
    };
  }, [allRows]);

  // Chart data — plot on both axes when available, or on the axis with data
  const allChartData = useMemo(() => {
    const data: DotDatum[] = [];
    for (const r of allRows) {
      if (r.earn1yr == null && r.earn5yr == null) continue;
      data.push({
        x: r.earn1yr ?? 0,
        y: r.earn5yr ?? 0,
        progKey: r.progKey,
        cipCode: r.cipCode,
        cipTitle: r.cipTitle,
        credTitle: r.credTitle,
        category: r.category,
        earn1yr: r.earn1yr,
        earn5yr: r.earn5yr,
      });
    }
    return data;
  }, [allRows]);

  // Dim/highlight based on filters
  const hasActiveFilter = !!(searchQuery.trim() || credFilter.size > 0 || compareSet.size > 0);

  const { dimmedData, highlightedByCategory } = useMemo(() => {
    if (!hasActiveFilter) {
      const groups: Record<string, DotDatum[]> = {};
      for (const d of allChartData) {
        if (!groups[d.category]) groups[d.category] = [];
        groups[d.category].push(d);
      }
      return { dimmedData: [] as DotDatum[], highlightedByCategory: groups };
    }
    const highlightKeys = compareSet.size > 0
      ? compareSet
      : new Set(filtered.map((r) => r.progKey));
    const dimmed: DotDatum[] = [];
    const groups: Record<string, DotDatum[]> = {};
    for (const d of allChartData) {
      if (highlightKeys.has(d.progKey)) {
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
    const key = data?.progKey ?? data?.payload?.progKey;
    if (key != null) {
      dotClickedRef.current = true;
      setSelectedProgram((prev) => (prev === key ? null : key));
    }
  }, []);

  const selectedRow = useMemo(() => {
    if (selectedProgram == null) return null;
    return allRows.find((r) => r.progKey === selectedProgram) ?? null;
  }, [selectedProgram, allRows]);

  const renderDot = useCallback(
    (props: any) => {
      const { cx, cy, fill, payload } = props;
      if (cx == null || cy == null) return <circle cx={0} cy={0} r={0} />;
      const key = payload?.progKey;
      const isSelected = key != null && key === selectedProgram;
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
    [selectedProgram],
  );

  const handleRowClick = useCallback((progKey: string) => {
    setSelectedProgram((prev) => (prev === progKey ? null : progKey));
    chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const handleCompareToggle = useCallback((progKey: string) => {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(progKey)) {
        next.delete(progKey);
      } else if (next.size < 4) {
        next.add(progKey);
      }
      return next;
    });
  }, []);

  const comparedPrograms = useMemo(() => {
    if (compareSet.size === 0) return [];
    return allRows.filter((r) => compareSet.has(r.progKey));
  }, [allRows, compareSet]);

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
      setSortDir(field === 'cipTitle' || field === 'credTitle' ? 'asc' : 'desc');
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

  const filtersActive = !!(searchQuery || credFilter.size > 0);

  return (
    <div>
      {/* Back link + title */}
      <Link
        href={`/?tab=${fromTab || 'colleges'}`}
        className="mb-4 inline-block text-sm text-accent hover:underline"
      >
        &larr; Back
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div>
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
        </div>
        <ShareButton title={`${school.name} - Earnings Data`} text={`Earnings data for ${school.name} programs`} />
      </div>
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

      {/* Scatter chart: 1yr vs 5yr earnings */}
      {hasScatterData && (
        <div
          ref={chartRef}
          className="mt-6 rounded-lg border border-gray-100 bg-white p-2 shadow-sm sm:p-4"
          style={{ userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest?.('svg')) e.preventDefault();
          }}
          onClick={(e) => {
            if (dotClickedRef.current) { dotClickedRef.current = false; return; }
            if ((e.target as HTMLElement).closest?.('svg')) setSelectedProgram(null);
          }}
        >
          <h3 className="mb-2 px-2 text-sm font-semibold text-text-primary">
            1-Year vs 5-Year Earnings &mdash; {allChartData.length} Programs
          </h3>
          <ResponsiveContainer width="100%" height={420}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="x"
                type="number"
                name="1yr Earnings"
                domain={xDomain}
                ticks={xTicks}
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fontSize: 11, fill: '#475569' }}
                label={{
                  value: '1-Year Earnings',
                  position: 'insideBottom',
                  offset: -10,
                  fontSize: 12,
                  fill: '#475569',
                }}
              />
              <YAxis
                dataKey="y"
                type="number"
                name="5yr Earnings"
                domain={yDomain}
                ticks={yTicks}
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fontSize: 11, fill: '#475569' }}
                width={60}
                label={{
                  value: '5-Year Earnings',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 5,
                  fontSize: 12,
                  fill: '#475569',
                }}
              />
              <Tooltip content={<ChartTooltip />} cursor={false} />
              {school.costAttendance != null && school.costAttendance > 0 && (
                <>
                  <ReferenceLine
                    segment={[{ x: school.costAttendance, y: 0 }, { x: school.costAttendance, y: school.costAttendance }]}
                    stroke="#ef4444"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                  />
                  <ReferenceLine
                    segment={[{ x: 0, y: school.costAttendance }, { x: school.costAttendance, y: school.costAttendance }]}
                    stroke="#ef4444"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                  />
                </>
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
              {/* Highlighted points by CIP category — reverse so top categories render last (on top) */}
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
            {school.costAttendance != null && school.costAttendance > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="inline-block h-0 w-4 border-t-[1.5px] border-dashed" style={{ borderColor: '#ef4444', opacity: 0.6 }} />
                Cost ({formatCompact(school.costAttendance)})
              </span>
            )}
          </div>

          {/* Detail card — shown when a program dot is selected */}
          {selectedRow && (
            <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: CIP_CATEGORY_COLORS[selectedRow.category] ?? '#475569' }}
                    />
                    <span className="truncate text-base font-semibold text-text-primary">
                      {selectedRow.cipTitle.replace(/\.+$/, '')}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {selectedRow.credTitle} &middot; {selectedRow.category}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProgram(null)}
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
                  <p className="text-sm font-semibold">
                    {selectedRow.costAttendance != null && selectedRow.costAttendance > 0
                      ? formatCurrency(selectedRow.costAttendance) : '\u2014'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">ROI</p>
                  <p className="text-sm font-semibold">
                    {selectedRow.multiple > 0 ? selectedRow.multiple.toFixed(1) + 'x' : '\u2014'}
                  </p>
                </div>
              </div>

              <Link
                href={`/majors/${encodeURIComponent(selectedRow.cipCode)}?from=colleges`}
                className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
              >
                View major details &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Comparison panel */}
      {comparedPrograms.length >= 2 && (
        <div className="mt-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Comparing {comparedPrograms.length} Programs
            </h3>
            <button
              onClick={() => setCompareSet(new Set())}
              className="text-xs text-accent hover:underline"
            >
              Clear
            </button>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${comparedPrograms.length}, 1fr)` }}>
            {comparedPrograms.map((r) => (
              <div key={r.progKey} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: CIP_CATEGORY_COLORS[r.category] ?? '#475569' }}
                  />
                  <span className="truncate text-xs font-semibold text-text-primary">
                    {r.cipTitle.replace(/\.+$/, '')}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-text-secondary">{r.credTitle} &middot; {r.category}</p>
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
                    <span className="font-medium">
                      {r.costAttendance != null && r.costAttendance > 0 ? formatCurrency(r.costAttendance) : '\u2014'}
                    </span>
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
            <div className="flex flex-wrap gap-1">
              {credOptions.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCredFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(c)) next.delete(c);
                      else next.add(c);
                      return next;
                    });
                    setPage(1);
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    credFilter.has(c)
                      ? 'bg-accent text-white'
                      : 'border border-gray-200 bg-white text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {c}
                </button>
              ))}
              {credFilter.size > 0 && (
                <button
                  onClick={() => { setCredFilter(new Set()); setPage(1); }}
                  className="rounded-full px-2 py-1 text-xs text-accent hover:bg-accent/10"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {filtersActive && (
          <button
            onClick={() => {
              setSearchQuery('');
              setCredFilter(new Set());
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
                key={r.progKey}
                onClick={() => handleRowClick(r.progKey)}
                className={`cursor-pointer border-t border-gray-50 transition-colors ${
                  selectedProgram === r.progKey
                    ? 'bg-accent/10'
                    : compareSet.has(r.progKey)
                      ? 'bg-accent/5'
                      : 'hover:bg-gray-50'
                }`}
              >
                <td className="w-8 px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={compareSet.has(r.progKey)}
                    disabled={!compareSet.has(r.progKey) && compareSet.size >= 4}
                    onChange={() => handleCompareToggle(r.progKey)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-accent accent-accent"
                  />
                </td>
                <td className="px-3 py-2 text-text-secondary">{r.rank}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: CIP_CATEGORY_COLORS[r.category] ?? '#475569' }}
                    />
                    <Link
                      href={`/majors/${encodeURIComponent(r.cipCode)}?from=colleges`}
                      className="font-medium text-accent hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.cipTitle.replace(/\.+$/, '')}
                    </Link>
                    <span className="text-text-secondary sm:hidden">
                      {r.credTitle}
                    </span>
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
