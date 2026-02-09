'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

export default function PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const enteredAt = useRef(Date.now());

  useEffect(() => {
    enteredAt.current = Date.now();
    trackEvent('page_view');

    return () => {
      const dwellMs = Date.now() - enteredAt.current;
      if (dwellMs > 500) {
        trackEvent('page_exit', { dwellMs });
      }
    };
  }, [pathname, searchParams]);

  return null;
}
