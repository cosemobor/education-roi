'use client';

import { useState } from 'react';
import type { ViewTab, MajorSummary, SchoolRanking } from '@/types';
import PageNav from '@/components/PageNav';
import DotPlot from '@/components/DotPlot';
import MajorRankings from '@/components/MajorRankings';
import CollegeRankings from '@/components/CollegeRankings';

interface AppShellProps {
  majorsSummary: MajorSummary[];
  schoolRankings: SchoolRanking[];
}

export default function AppShell({ majorsSummary, schoolRankings }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('explorer');
  const [showMethodology, setShowMethodology] = useState(false);

  return (
    <>
      <PageNav activeTab={activeTab} onTabChange={setActiveTab} />

      <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
        Education ROI Explorer
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Find the highest-earning combinations of school and major using College
        Scorecard data
      </p>
      <button
        onClick={() => setShowMethodology((v) => !v)}
        className="mt-1.5 text-xs text-accent hover:underline"
      >
        {showMethodology ? 'Hide methodology' : 'About this data & methodology'}
      </button>
      {showMethodology && (
        <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-text-secondary">
          <p>
            All data is sourced from the{' '}
            <strong>U.S. Department of Education College Scorecard</strong>,
            which reports earnings of federal financial aid recipients one, four,
            and five years after graduation.
          </p>
          <p className="mt-2">
            <strong>College rankings</strong> use graduate-weighted average
            earnings &mdash; each program&rsquo;s median earnings are weighted by the
            number of graduates reporting, so large programs count more than
            small ones. This prevents specialized schools with a handful of
            high-earning programs from dominating the rankings.
          </p>
          <p className="mt-2">
            <strong>ROI (Return on Investment)</strong> is calculated as
            first-year weighted earnings divided by cost of attendance. A 1.0x
            ROI means graduates earn back their full cost of attendance in the
            first year.
          </p>
          <p className="mt-2">
            <strong>Major rankings</strong> use unweighted median earnings across
            all schools offering that major, with percentile ranges (25th&ndash;75th)
            to show the spread.
          </p>
          <p className="mt-2">
            Earnings reflect median values &mdash; half of graduates earn more and
            half earn less. Data may not cover all programs or schools, as the
            Scorecard suppresses data where sample sizes are too small to protect
            student privacy.
          </p>
        </div>
      )}

      {activeTab === 'explorer' && (
        <DotPlot majorsSummary={majorsSummary} />
      )}
      {activeTab === 'majors' && (
        <MajorRankings majorsSummary={majorsSummary} />
      )}
      {activeTab === 'colleges' && (
        <CollegeRankings schoolRankings={schoolRankings} />
      )}
    </>
  );
}
