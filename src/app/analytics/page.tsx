import type { Metadata } from 'next';
import { getDb } from '@/lib/db';
import { analyticsEvents } from '@/lib/db/schema';
import { sql, eq, desc, countDistinct, count } from 'drizzle-orm';
import PageNav from '@/components/PageNav';
import StatCard from '@/components/StatCard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analytics',
  robots: { index: false, follow: false },
};

interface DailyRow {
  day: string;
  sessions: number;
  events: number;
  pageViews: number;
  searches: number;
}

interface CountRow {
  label: string;
  cnt: number;
}

export default async function AnalyticsPage() {
  const db = getDb();

  const [
    overviewRows,
    dailyRows,
    topPagesRows,
    topSearchRows,
    eventBreakdownRows,
    topClickedRows,
  ] = await Promise.all([
    // Overview stats
    db
      .select({
        totalSessions: countDistinct(analyticsEvents.sessionId),
        totalEvents: count(),
      })
      .from(analyticsEvents),

    // Daily traffic (last 30 days)
    db.all<DailyRow>(sql`
      SELECT
        DATE(timestamp) as day,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(*) as events,
        SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as "pageViews",
        SUM(CASE WHEN event_type = 'search_query' THEN 1 ELSE 0 END) as searches
      FROM analytics_events
      WHERE timestamp >= DATE('now', '-30 days')
      GROUP BY day
      ORDER BY day DESC
    `),

    // Top pages
    db.all<CountRow>(sql`
      SELECT page as label, COUNT(*) as cnt
      FROM analytics_events
      WHERE event_type = 'page_view' AND page IS NOT NULL
      GROUP BY page
      ORDER BY cnt DESC
      LIMIT 20
    `),

    // Top searches
    db.all<CountRow>(sql`
      SELECT JSON_EXTRACT(event_data, '$.query') as label, COUNT(*) as cnt
      FROM analytics_events
      WHERE event_type = 'search_query' AND event_data IS NOT NULL
      GROUP BY label
      ORDER BY cnt DESC
      LIMIT 20
    `),

    // Event type breakdown
    db.all<CountRow>(sql`
      SELECT event_type as label, COUNT(*) as cnt
      FROM analytics_events
      GROUP BY event_type
      ORDER BY cnt DESC
    `),

    // Top clicked entities (majors + schools + programs)
    db.all<CountRow>(sql`
      SELECT event_data as label, COUNT(*) as cnt
      FROM analytics_events
      WHERE event_type IN ('major_click', 'school_click', 'program_click')
        AND event_data IS NOT NULL
      GROUP BY event_data
      ORDER BY cnt DESC
      LIMIT 20
    `),
  ]);

  const overview = overviewRows[0] ?? { totalSessions: 0, totalEvents: 0 };

  // Count page views and searches from the breakdown
  const pageViewCount =
    eventBreakdownRows.find((r) => r.label === 'page_view')?.cnt ?? 0;
  const searchCount =
    eventBreakdownRows.find((r) => r.label === 'search_query')?.cnt ?? 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <PageNav />

      <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
        Analytics
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Usage data from the analytics_events table
      </p>

      {/* Overview */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Sessions" value={Number(overview.totalSessions).toLocaleString()} />
        <StatCard label="Total Events" value={Number(overview.totalEvents).toLocaleString()} />
        <StatCard label="Page Views" value={Number(pageViewCount).toLocaleString()} />
        <StatCard label="Searches" value={Number(searchCount).toLocaleString()} />
      </div>

      {/* Daily traffic */}
      <Section title="Daily Traffic (Last 30 Days)">
        {dailyRows.length === 0 ? (
          <EmptyState />
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b border-gray-100 bg-gray-50/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Date</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Sessions</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Events</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Page Views</th>
                <th className="hidden px-3 py-2 text-right font-medium text-text-secondary sm:table-cell">Searches</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((row) => (
                <tr key={row.day} className="border-b border-gray-50">
                  <td className="px-3 py-2 text-text-primary">{row.day}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-primary">{Number(row.sessions).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{Number(row.events).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{Number(row.pageViews).toLocaleString()}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums text-text-secondary sm:table-cell">{Number(row.searches).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Event breakdown */}
        <Section title="Event Breakdown">
          {eventBreakdownRows.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full text-xs">
              <thead className="border-b border-gray-100 bg-gray-50/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Event Type</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">Count</th>
                </tr>
              </thead>
              <tbody>
                {eventBreakdownRows.map((row) => (
                  <tr key={row.label} className="border-b border-gray-50">
                    <td className="px-3 py-2 font-medium text-text-primary">{row.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{Number(row.cnt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Top pages */}
        <Section title="Top Pages">
          {topPagesRows.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full text-xs">
              <thead className="border-b border-gray-100 bg-gray-50/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Page</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">Views</th>
                </tr>
              </thead>
              <tbody>
                {topPagesRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="max-w-[200px] truncate px-3 py-2 font-medium text-text-primary">{row.label || '/'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{Number(row.cnt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Top searches */}
        <Section title="Top Searches">
          {topSearchRows.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full text-xs">
              <thead className="border-b border-gray-100 bg-gray-50/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Query</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">Count</th>
                </tr>
              </thead>
              <tbody>
                {topSearchRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="max-w-[200px] truncate px-3 py-2 text-text-primary">{row.label || '(empty)'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{Number(row.cnt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Top clicked entities */}
        <Section title="Top Clicked (Majors/Schools)">
          {topClickedRows.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full text-xs">
              <thead className="border-b border-gray-100 bg-gray-50/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Entity</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {topClickedRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="max-w-[200px] truncate px-3 py-2 text-text-primary">{formatEntityLabel(row.label)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{Number(row.cnt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-gray-100 shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <p className="px-4 py-8 text-center text-sm text-text-secondary">
      No data yet
    </p>
  );
}

function formatEntityLabel(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.cipCode) return `Major: ${parsed.cipCode}`;
    if (parsed.unitId) return `School: ${parsed.unitId}`;
    return raw;
  } catch {
    return raw || '(unknown)';
  }
}
