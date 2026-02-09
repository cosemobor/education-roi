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
    <nav className="mb-6 flex items-center gap-1.5 overflow-x-auto sm:gap-3">
      <span className="flex-shrink-0 text-sm font-bold text-text-primary sm:text-base">
        EduROI
      </span>
      <div className="h-4 w-px flex-shrink-0 bg-gray-300" />
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={`flex-shrink-0 rounded-md px-2.5 py-2 text-xs transition-colors sm:px-3 sm:text-sm ${
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
