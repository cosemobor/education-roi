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
import { formatCurrency, formatCompact, formatRate } from '@/lib/formatters';
import { getDisplayTier, TIER_COLORS, TIER_ORDER } from '@/lib/tiers';
import SearchInput, { type SearchOption } from './SearchInput';
import StatCard from './StatCard';

type EarningsKey = 'earn1yr' | 'earn5yr';
type SortField = 'schoolName' | 'earn1yr' | 'earn5yr' | 'cost' | 'multiple';

interface DotPlotProps {
  majorsSummary: MajorSummary[];
}

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

interface RankedProgram {
  rank: number;
  unitId: number;
  schoolName: string;
  state: string;
  tier: string;
  earn1yr: number | null;
  earn5yr: number | null;
  cost: number;
  multiple: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DotDatum }> }) {
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
    </div>
  );
}

export default function DotPlot({ majorsSummary }: DotPlotProps) {
  const [selectedMajor, setSelectedMajor] = useState<SearchOption | null>(null);
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [earningsKey, setEarningsKey] = useState<EarningsKey>('earn1yr');

  // Filters
  const [stateFilter, setStateFilter] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<number | null>(null);
  const [minSat, setMinSat] = useState('');
  const [maxAdmRate, setMaxAdmRate] = useState('');

  // Table sort — default to 1yr earnings desc
  const [sortField, setSortField] = useState<SortField>('earn1yr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Table search
  const [tableSearch, setTableSearch] = useState('');

  // Selection & comparison
  const [selectedSchool, setSelectedSchool] = useState<number | null>(null);
  const [compareSet, setCompareSet] = useState<Set<number>>(new Set());

  const didAutoSelect = useRef(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // Responsive hook for chart config (Recharts needs JS values, not CSS classes)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Close detail card on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedSchool(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const majorOptions: SearchOption[] = useMemo(
    () =>
      majorsSummary.map((m) => ({
        id: m.cipCode,
        label: m.cipTitle,
        sublabel: m.medianEarn1yr ? formatCurrency(m.medianEarn1yr) + ' median' : undefined,
      })),
    [majorsSummary],
  );

  const fetchPrograms = useCallback(async (cipCode: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/programs?cip=${encodeURIComponent(cipCode)}`);
      const json = await res.json();
      setPrograms(json.data ?? []);
    } catch {
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMajorChange = useCallback(
    (option: SearchOption | null) => {
      setSelectedMajor(option);
      setStateFilter('');
      setOwnershipFilter(null);
      setMinSat('');
      setMaxAdmRate('');
      setSelectedSchool(null);
      setCompareSet(new Set());
      setTableSearch('');
      if (!option) {
        setPrograms([]);
        return;
      }
      fetchPrograms(option.id);
    },
    [fetchPrograms],
  );

  // Auto-select first major with schoolCount >= 100
  useEffect(() => {
    if (didAutoSelect.current || majorsSummary.length === 0 || majorOptions.length === 0) return;
    didAutoSelect.current = true;
    const robust = majorsSummary.find((m) => m.schoolCount >= 100);
    const pick = robust ?? majorsSummary[0];
    const option = majorOptions.find((o) => o.id === pick.cipCode);
    if (option) {
      setSelectedMajor(option);
      fetchPrograms(option.id);
    }
  }, [majorsSummary, majorOptions, fetchPrograms]);

  const states = useMemo(() => {
    const s = new Set(programs.map((p) => p.state).filter(Boolean));
    return Array.from(s).sort();
  }, [programs]);

  // Count of programs with cost + selected earnings data (before user filters)
  const baseCount = useMemo(() => {
    return programs.filter(
      (p) => p.costAttendance != null && p[earningsKey] != null,
    ).length;
  }, [programs, earningsKey]);

  const filtered = useMemo(() => {
    let list = programs.filter(
      (p) => p.costAttendance != null && p[earningsKey] != null,
    );
    if (stateFilter) list = list.filter((p) => p.state === stateFilter);
    if (ownershipFilter != null)
      list = list.filter((p) => p.ownership === ownershipFilter);

    // SAT filter: require both scores to be non-null
    if (minSat) {
      const threshold = parseInt(minSat, 10);
      if (!isNaN(threshold)) {
        list = list.filter((p) => {
          if (p.satMath75 == null || p.satRead75 == null) return false;
          return p.satMath75 + p.satRead75 >= threshold;
        });
      }
    }

    // Admission rate filter
    if (maxAdmRate) {
      const threshold = parseInt(maxAdmRate, 10) / 100;
      if (!isNaN(threshold)) {
        list = list.filter(
          (p) => p.admissionRate != null && p.admissionRate <= threshold,
        );
      }
    }
    return list;
  }, [programs, earningsKey, stateFilter, ownershipFilter, minSat, maxAdmRate]);

  // Group by display tier for color coding
  const tierData = useMemo(() => {
    const groups: Record<string, DotDatum[]> = {};
    for (const p of filtered) {
      const tier = getDisplayTier(p.schoolName, p.selectivityTier || '');
      if (!groups[tier]) groups[tier] = [];
      groups[tier].push({
        x: p.costAttendance!,
        y: p[earningsKey]!,
        unitId: p.unitId,
        schoolName: p.schoolName,
        state: p.state,
        tier,
        credTitle: p.credTitle,
        costAttendance: p.costAttendance!,
        earnings: p[earningsKey]!,
      });
    }
    return groups;
  }, [filtered, earningsKey]);

  // Dynamic axis domains with padding
  const { yDomain, xDomain } = useMemo(() => {
    if (!filtered.length)
      return {
        yDomain: [0, 100000] as [number, number],
        xDomain: [0, 80000] as [number, number],
      };
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of filtered) {
      const x = p.costAttendance!;
      const y = p[earningsKey]!;
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
  }, [filtered, earningsKey]);

  const currentMajorSummary = useMemo(
    () => majorsSummary.find((m) => m.cipCode === selectedMajor?.id),
    [majorsSummary, selectedMajor],
  );

  const medianLine =
    earningsKey === 'earn1yr'
      ? currentMajorSummary?.medianEarn1yr
      : currentMajorSummary?.medianEarn5yr;

  const topEarner = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.reduce((best, p) =>
      (p[earningsKey] ?? 0) > (best[earningsKey] ?? 0) ? p : best,
    );
  }, [filtered, earningsKey]);

  // Rankings table data — always includes both 1yr and 5yr
  const ranked = useMemo(() => {
    const rows: RankedProgram[] = filtered.map((p) => {
      const activeEarnings = p[earningsKey] ?? 0;
      return {
        rank: 0,
        unitId: p.unitId,
        schoolName: p.schoolName,
        state: p.state,
        tier: getDisplayTier(p.schoolName, p.selectivityTier || ''),
        earn1yr: p.earn1yr,
        earn5yr: p.earn5yr,
        cost: p.costAttendance!,
        multiple: p.costAttendance! > 0 ? activeEarnings / p.costAttendance! : 0,
      };
    });

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
  }, [filtered, earningsKey, sortField, sortDir]);

  // Filter ranked rows by table search (preserves original rank numbers)
  const displayedRanked = useMemo(() => {
    if (!tableSearch.trim()) return ranked;
    const q = tableSearch.toLowerCase();
    return ranked.filter((r) => r.schoolName.toLowerCase().includes(q));
  }, [ranked, tableSearch]);

  // Selected school detail
  const selectedProgram = useMemo(() => {
    if (selectedSchool == null) return null;
    return filtered.find((p) => p.unitId === selectedSchool) ?? null;
  }, [selectedSchool, filtered]);

  // Comparison data
  const comparedPrograms = useMemo(() => {
    if (compareSet.size === 0) return [];
    return filtered.filter((p) => compareSet.has(p.unitId));
  }, [filtered, compareSet]);

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(field === 'schoolName' ? 'asc' : 'desc');
      return field;
    });
  }, []);

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

  const earningsLabel = earningsKey === 'earn1yr' ? '1-Year' : '5-Year';

  const sortArrow = (field: SortField) => {
    if (sortField !== field) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  // Custom dot shape for chart — handles highlight and compare states
  const renderDot = useCallback(
    (props: any) => {
      const { cx, cy, fill, payload } = props;
      if (cx == null || cy == null) return <circle cx={0} cy={0} r={0} />;

      const uid = payload?.unitId;
      const isSelected = uid != null && uid === selectedSchool;
      const isCompared = uid != null && compareSet.has(uid);

      if (isSelected) {
        return (
          <g>
            <circle cx={cx} cy={cy} r={14} fill={fill} opacity={0.12} />
            <circle cx={cx} cy={cy} r={7} fill={fill} stroke="#1a1a1a" strokeWidth={2.5} />
          </g>
        );
      }
      if (isCompared) {
        return (
          <circle cx={cx} cy={cy} r={7} fill={fill} stroke="#ffffff" strokeWidth={2} />
        );
      }
      return <circle cx={cx} cy={cy} r={5} fill={fill} opacity={0.75} />;
    },
    [selectedSchool, compareSet],
  );

  const filtersActive = !!(stateFilter || ownershipFilter != null || minSat || maxAdmRate);

  return (
    <div className="mt-6 space-y-4">
      {/* Major selector + Earnings toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            Select a Major
          </label>
          <SearchInput
            options={majorOptions}
            value={selectedMajor}
            onChange={handleMajorChange}
            placeholder="Search majors..."
          />
        </div>
        <div className="self-start sm:self-auto">
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            Earnings
          </label>
          <div className="inline-flex rounded-lg border border-gray-200 text-xs">
            <button
              onClick={() => setEarningsKey('earn1yr')}
              className={`px-3 py-2 transition-colors ${
                earningsKey === 'earn1yr'
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              } rounded-l-lg`}
            >
              1-Year
            </button>
            <button
              onClick={() => setEarningsKey('earn5yr')}
              className={`px-3 py-2 transition-colors ${
                earningsKey === 'earn5yr'
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              } rounded-r-lg`}
            >
              5-Year
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      {programs.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 items-end gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:flex sm:flex-wrap">
            <div className="col-span-2">
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
                    onClick={() => setOwnershipFilter(val)}
                    className={`flex-1 px-2.5 py-1.5 transition-colors first:rounded-l-lg last:rounded-r-lg sm:flex-none ${
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
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent sm:w-auto"
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
                Min SAT (combined)
              </label>
              <input
                type="number"
                placeholder="e.g. 1200"
                value={minSat}
                onChange={(e) => setMinSat(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-accent sm:w-24"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                Max Admit Rate
              </label>
              <select
                value={maxAdmRate}
                onChange={(e) => setMaxAdmRate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent sm:w-auto"
              >
                <option value="">Any</option>
                <option value="10">Under 10%</option>
                <option value="25">Under 25%</option>
                <option value="50">Under 50%</option>
                <option value="75">Under 75%</option>
              </select>
            </div>

            {filtersActive && (
              <button
                onClick={() => {
                  setStateFilter('');
                  setOwnershipFilter(null);
                  setMinSat('');
                  setMaxAdmRate('');
                }}
                className="col-span-2 rounded-lg px-2 py-1.5 text-xs text-accent hover:bg-accent/10 sm:col-span-1"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Filter count info */}
          <p className="text-xs text-text-secondary">
            Showing {filtered.length} of {baseCount} programs
            {filtered.length < baseCount && (
              <span>
                {' '}
                &middot;{' '}
                {baseCount - filtered.length} hidden by filters
                {minSat && ' (schools without SAT data excluded)'}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Chart area */}
      {loading && (
        <div className="flex h-96 items-center justify-center text-sm text-text-secondary">
          Loading programs...
        </div>
      )}

      {!loading && !selectedMajor && (
        <div className="flex h-96 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-text-secondary">
          Select a major above to see earnings vs. cost for every school offering it
        </div>
      )}

      {!loading && selectedMajor && filtered.length === 0 && (
        <div className="flex h-96 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-text-secondary">
          No programs match the current filters
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Programs" value={String(filtered.length)} />
            <StatCard
              label={`${earningsLabel} Median`}
              value={formatCurrency(medianLine ?? null)}
            />
            <StatCard
              label="Top Earner"
              value={topEarner ? formatCurrency(topEarner[earningsKey]) : '—'}
              detail={topEarner?.schoolName}
            />
            <StatCard
              label="Best ROI"
              value={ranked[0] ? `${ranked[0].multiple.toFixed(1)}x` : '—'}
              detail={ranked[0]?.schoolName}
            />
          </div>

          {/* Comparison panel */}
          {comparedPrograms.length >= 2 && (
            <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">
                  Comparing {comparedPrograms.length} Schools
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
                  comparedPrograms.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : comparedPrograms.length === 3
                      ? 'grid-cols-1 sm:grid-cols-3'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                }`}
              >
                {comparedPrograms.map((p) => {
                  const tier = getDisplayTier(p.schoolName, p.selectivityTier || '');
                  const roi =
                    p.costAttendance && p[earningsKey]
                      ? (p[earningsKey]! / p.costAttendance).toFixed(1) + 'x'
                      : '—';
                  return (
                    <div
                      key={p.unitId}
                      className="rounded-lg border border-gray-100 p-3"
                    >
                      <div className="mb-2 flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: TIER_COLORS[tier] ?? '#9ca3af' }}
                        />
                        <Link
                          href={`/schools/${p.unitId}`}
                          className="truncate text-sm font-semibold text-accent hover:underline"
                        >
                          {p.schoolName}
                        </Link>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">1yr Earnings</span>
                          <span className="font-medium text-earn-above">
                            {formatCurrency(p.earn1yr)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">5yr Earnings</span>
                          <span className="font-medium text-earn-above">
                            {formatCurrency(p.earn5yr)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Cost</span>
                          <span className="font-medium">
                            {formatCurrency(p.costAttendance)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">ROI</span>
                          <span className="font-semibold">{roi}</span>
                        </div>
                        <hr className="border-gray-100" />
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Admit Rate</span>
                          <span>{formatRate(p.admissionRate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">SAT</span>
                          <span>
                            {p.satMath75 != null && p.satRead75 != null
                              ? p.satMath75 + p.satRead75
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Size</span>
                          <span>{p.size?.toLocaleString() ?? '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Completion</span>
                          <span>{formatRate(p.completionRate)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scatter chart */}
          <div
            ref={chartRef}
            className="rounded-lg border border-gray-100 bg-white p-2 shadow-sm sm:p-4"
            style={{ userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
            onMouseDown={(e) => {
              // Prevent browser drag-selection on SVG (the blue box)
              if ((e.target as HTMLElement).closest?.('svg')) e.preventDefault();
            }}
          >
            <ResponsiveContainer width="100%" height={isMobile ? 300 : 420}>
              <ScatterChart
                margin={
                  isMobile
                    ? { top: 5, right: 10, bottom: 10, left: 0 }
                    : { top: 10, right: 20, bottom: 20, left: 10 }
                }
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="x"
                  type="number"
                  name="Cost"
                  domain={xDomain}
                  tickFormatter={(v: number) => formatCompact(v)}
                  tick={{ fontSize: isMobile ? 10 : 11, fill: '#6b7280' }}
                  label={
                    isMobile
                      ? undefined
                      : {
                          value: 'Cost of Attendance',
                          position: 'insideBottom',
                          offset: -10,
                          fontSize: 12,
                          fill: '#6b7280',
                        }
                  }
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name="Earnings"
                  domain={yDomain}
                  tickFormatter={(v: number) => formatCompact(v)}
                  tick={{ fontSize: isMobile ? 10 : 11, fill: '#6b7280' }}
                  width={isMobile ? 45 : 60}
                  label={
                    isMobile
                      ? undefined
                      : {
                          value: `${earningsLabel} Earnings`,
                          angle: -90,
                          position: 'insideLeft',
                          offset: 5,
                          fontSize: 12,
                          fill: '#6b7280',
                        }
                  }
                />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                {medianLine && (
                  <ReferenceLine
                    y={medianLine}
                    stroke="#6b7280"
                    strokeDasharray="6 4"
                    label={{
                      value: isMobile
                        ? formatCompact(medianLine)
                        : `National Median ${formatCompact(medianLine)}`,
                      position: isMobile ? 'insideTopLeft' : 'right',
                      fontSize: isMobile ? 10 : 11,
                      fill: '#6b7280',
                    }}
                  />
                )}
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ fontSize: isMobile ? 10 : 11, paddingBottom: isMobile ? 4 : 8 }}
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

          {/* Detail card — shown when a school is selected */}
          {selectedProgram && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          TIER_COLORS[
                            getDisplayTier(
                              selectedProgram.schoolName,
                              selectedProgram.selectivityTier || '',
                            )
                          ] ?? '#9ca3af',
                      }}
                    />
                    <Link
                      href={`/schools/${selectedProgram.unitId}`}
                      className="truncate text-base font-semibold text-accent hover:underline"
                    >
                      {selectedProgram.schoolName}
                    </Link>
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {selectedProgram.state} &middot; {selectedProgram.credTitle} &middot;{' '}
                    {getDisplayTier(
                      selectedProgram.schoolName,
                      selectedProgram.selectivityTier || '',
                    )}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    onClick={() => handleCompareToggle(selectedProgram.unitId)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      compareSet.has(selectedProgram.unitId)
                        ? 'bg-accent text-white'
                        : 'border border-accent text-accent hover:bg-accent/10'
                    }`}
                  >
                    {compareSet.has(selectedProgram.unitId) ? 'In Compare' : 'Add to Compare'}
                  </button>
                  <button
                    onClick={() => setSelectedSchool(null)}
                    className="rounded-lg px-2 py-1 text-lg text-text-secondary hover:text-text-primary"
                  >
                    &times;
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                    1yr Earnings
                  </p>
                  <p className="text-sm font-semibold text-earn-above">
                    {formatCurrency(selectedProgram.earn1yr)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                    5yr Earnings
                  </p>
                  <p className="text-sm font-semibold text-earn-above">
                    {formatCurrency(selectedProgram.earn5yr)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                    Cost
                  </p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(selectedProgram.costAttendance)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                    ROI
                  </p>
                  <p className="text-sm font-semibold">
                    {selectedProgram.costAttendance
                      ? (
                          (selectedProgram[earningsKey] ?? 0) /
                          selectedProgram.costAttendance
                        ).toFixed(1) + 'x'
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-text-secondary">Admit Rate: </span>
                  <span className="font-medium">
                    {formatRate(selectedProgram.admissionRate)}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">SAT: </span>
                  <span className="font-medium">
                    {selectedProgram.satMath75 != null && selectedProgram.satRead75 != null
                      ? (selectedProgram.satMath75 + selectedProgram.satRead75).toLocaleString()
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">Enrollment: </span>
                  <span className="font-medium">
                    {selectedProgram.size?.toLocaleString() ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">Completion: </span>
                  <span className="font-medium">
                    {formatRate(selectedProgram.completionRate)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Rankings table */}
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  Rankings — {selectedMajor?.label}
                </h3>
                <p className="text-xs text-text-secondary">
                  {displayedRanked.length === ranked.length
                    ? `${filtered.length} programs`
                    : `${displayedRanked.length} of ${filtered.length} programs`}
                  {compareSet.size > 0 && (
                    <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-accent">
                      {compareSet.size}/4 selected for comparison
                    </span>
                  )}
                </p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search schools..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 pr-7 text-xs text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-accent sm:w-48"
                />
                {tableSearch && (
                  <button
                    onClick={() => setTableSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-[500px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-left">
                  <tr>
                    <th className="hidden w-10 px-2 py-2 sm:table-cell" />
                    <th className="px-2 py-2 font-medium text-text-secondary sm:px-4">#</th>
                    <th
                      className="cursor-pointer px-2 py-2 font-medium text-text-secondary hover:text-text-primary sm:px-4"
                      onClick={() => handleSort('schoolName')}
                    >
                      School{sortArrow('schoolName')}
                    </th>
                    <th
                      className="cursor-pointer px-2 py-2 text-right font-medium text-text-secondary hover:text-text-primary sm:px-4"
                      onClick={() => handleSort('earn1yr')}
                    >
                      <span className="sm:hidden">1yr</span>
                      <span className="hidden sm:inline">1yr Earnings</span>
                      {sortArrow('earn1yr')}
                    </th>
                    <th
                      className="hidden cursor-pointer px-4 py-2 text-right font-medium text-text-secondary hover:text-text-primary sm:table-cell"
                      onClick={() => handleSort('earn5yr')}
                    >
                      5yr Earnings{sortArrow('earn5yr')}
                    </th>
                    <th
                      className="hidden cursor-pointer px-4 py-2 text-right font-medium text-text-secondary hover:text-text-primary sm:table-cell"
                      onClick={() => handleSort('cost')}
                    >
                      Cost{sortArrow('cost')}
                    </th>
                    <th
                      className="cursor-pointer px-2 py-2 text-right font-medium text-text-secondary hover:text-text-primary sm:px-4"
                      onClick={() => handleSort('multiple')}
                    >
                      ROI{sortArrow('multiple')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRanked.map((r) => (
                    <tr
                      key={`${r.unitId}-${r.rank}`}
                      className={`cursor-pointer border-t border-gray-50 transition-colors ${
                        selectedSchool === r.unitId
                          ? 'bg-accent/10'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleRowClick(r.unitId)}
                    >
                      <td
                        className="hidden w-10 px-2 py-2 sm:table-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={compareSet.has(r.unitId)}
                          onChange={() => handleCompareToggle(r.unitId)}
                          disabled={
                            !compareSet.has(r.unitId) && compareSet.size >= 4
                          }
                          className="h-3.5 w-3.5 rounded border-gray-300 text-accent accent-accent"
                        />
                      </td>
                      <td className="px-2 py-2 text-text-secondary sm:px-4">{r.rank}</td>
                      <td className="max-w-[140px] px-2 py-2 sm:max-w-none sm:px-4">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                            style={{
                              backgroundColor: TIER_COLORS[r.tier] ?? '#9ca3af',
                            }}
                          />
                          <Link
                            href={`/schools/${r.unitId}`}
                            className="truncate font-medium text-accent hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.schoolName}
                          </Link>
                          <span className="flex-shrink-0 text-text-secondary">{r.state}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right font-medium text-earn-above sm:px-4">
                        {formatCurrency(r.earn1yr)}
                      </td>
                      <td className="hidden px-4 py-2 text-right font-medium text-earn-above sm:table-cell">
                        {r.earn5yr != null ? formatCurrency(r.earn5yr) : '—'}
                      </td>
                      <td className="hidden px-4 py-2 text-right text-text-secondary sm:table-cell">
                        {formatCurrency(r.cost)}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-text-primary sm:px-4">
                        {r.multiple.toFixed(1)}x
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
