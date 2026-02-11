'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ViewTab, MajorSummary, SchoolRanking } from '@/types';
import { trackEvent } from '@/lib/analytics';

const VALID_TABS: ViewTab[] = ['majors', 'colleges'];
import PageNav from '@/components/PageNav';
import MajorRankings from '@/components/MajorRankings';
import CollegeRankings from '@/components/CollegeRankings';
import GuidedTour from '@/components/GuidedTour';
import ShareButton from '@/components/ShareButton';

interface AppShellProps {
  majorsSummary: MajorSummary[];
  schoolRankings: SchoolRanking[];
}

export default function AppShell({ majorsSummary, schoolRankings }: AppShellProps) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as ViewTab | null;
  const [activeTab, setActiveTab] = useState<ViewTab>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'majors',
  );
  const [tourKey, setTourKey] = useState(0);
  const handleStartTour = useCallback(() => setTourKey((k) => k + 1), []);

  const handleTabChange = useCallback((tab: ViewTab) => {
    setActiveTab(tab);
    trackEvent('tab_switch', { tab });
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  }, []);

  return (
    <>
      <PageNav activeTab={activeTab} onTabChange={handleTabChange} onStartTour={handleStartTour} />

      <h1 data-tour="welcome" className="text-2xl font-bold text-text-primary sm:text-3xl">
        Higher Education Outcomes
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Explore earnings outcomes by school and major using College Scorecard
        data
      </p>
      <div className="mt-1.5 flex items-center gap-3">
        <Link href="/about" className="text-xs text-accent hover:underline">
          About this data &amp; methodology
        </Link>
        <ShareButton
          title="Higher Education Outcomes - College Earnings Explorer"
          text="Explore earnings outcomes by college major and school"
        />
      </div>

      {activeTab === 'majors' && (
        <MajorRankings majorsSummary={majorsSummary} />
      )}
      {activeTab === 'colleges' && (
        <CollegeRankings schoolRankings={schoolRankings} />
      )}

      <GuidedTour restartKey={tourKey} />
    </>
  );
}
