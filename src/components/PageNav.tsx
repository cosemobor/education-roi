'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ViewTab } from '@/types';

const TABS: { key: ViewTab; label: string }[] = [
  { key: 'explorer', label: 'College x Major' },
  { key: 'colleges', label: 'Colleges' },
  { key: 'majors', label: 'Majors' },
];

interface PageNavProps {
  activeTab?: ViewTab;
  onTabChange?: (tab: ViewTab) => void;
  onStartTour?: () => void;
}

export default function PageNav({ activeTab, onTabChange, onStartTour }: PageNavProps) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isAbout = pathname === '/about';

  return (
    <nav data-tour="nav-tabs" className="mb-6 flex items-center gap-1 sm:gap-3">
      <Link href="/" className="flex-shrink-0 text-sm font-bold text-text-primary hover:text-accent sm:text-base">
        HEO
      </Link>
      <div className="h-4 w-px flex-shrink-0 bg-gray-300" />
      {TABS.map(({ key, label }) => {
        const isActive = isHome && activeTab === key;

        if (isHome && onTabChange) {
          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`flex-shrink-0 rounded-md px-1.5 py-2 text-xs transition-colors sm:px-2 sm:text-sm ${
                isActive
                  ? 'bg-accent/10 font-semibold text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          );
        }

        return (
          <Link
            key={key}
            href={`/?tab=${key}`}
            className="flex-shrink-0 rounded-md px-1.5 py-2 text-xs text-text-secondary transition-colors hover:text-text-primary sm:px-2 sm:text-sm"
          >
            {label}
          </Link>
        );
      })}
      <div className="ml-auto" />
      <Link
        href="/about"
        data-tour="about-link"
        className={`flex-shrink-0 rounded-md px-1.5 py-2 text-xs transition-colors sm:px-2 sm:text-sm ${
          isAbout
            ? 'bg-accent/10 font-semibold text-accent'
            : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        About
      </Link>
      <a
        href="https://hamindex.com"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden flex-shrink-0 rounded-md px-2 py-2 text-xs text-text-secondary transition-colors hover:text-text-primary sm:inline sm:text-sm"
      >
        Housing
      </a>
      {onStartTour && (
        <button
          onClick={onStartTour}
          title="Take a tour"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold leading-none text-text-secondary transition-colors hover:border-accent hover:text-accent sm:ml-1"
        >
          i
        </button>
      )}
    </nav>
  );
}
