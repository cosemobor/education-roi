'use client';

import type { ViewTab } from '@/types';

const TABS: { key: ViewTab; label: string }[] = [
  { key: 'explorer', label: 'Major \u00D7 College' },
  { key: 'colleges', label: 'College Rankings' },
  { key: 'majors', label: 'Major Rankings' },
];

interface PageNavProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
}

export default function PageNav({ activeTab, onTabChange }: PageNavProps) {
  return (
    <nav className="mb-6 flex items-center gap-2 sm:gap-3">
      <span className="text-sm font-bold text-text-primary sm:text-base">
        EduROI
      </span>
      <div className="h-4 w-px bg-gray-300" />
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={`rounded-md px-2 py-1 text-xs transition-colors sm:text-sm ${
            activeTab === key
              ? 'bg-accent/10 font-semibold text-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
