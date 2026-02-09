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
