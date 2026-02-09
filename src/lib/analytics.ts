import type { AnalyticsEventType } from '@/types';

const BATCH_SIZE = 20;
const FLUSH_INTERVAL = 10_000;
const SEARCH_DEBOUNCE = 1_000;

interface QueuedEvent {
  type: AnalyticsEventType;
  data?: Record<string, string | number | boolean>;
  page: string;
  timestamp: number;
  sessionId: string;
}

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = sessionStorage.getItem('eduroi_session');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('eduroi_session', sid);
  }
  return sid;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL);
}

function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, BATCH_SIZE);
  const body = JSON.stringify({ events: batch });

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', body);
  } else {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  if (queue.length > 0) scheduleFlush();
}

export function trackEvent(
  type: AnalyticsEventType,
  data?: Record<string, string | number | boolean>,
) {
  if (typeof window === 'undefined') return;

  queue.push({
    type,
    data,
    page: window.location.pathname + window.location.search,
    timestamp: Date.now(),
    sessionId: getSessionId(),
  });

  if (queue.length >= BATCH_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}

export function trackSearchQuery(query: string) {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    trackEvent('search_query', { query });
  }, SEARCH_DEBOUNCE);
}

// Flush on page hide
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
