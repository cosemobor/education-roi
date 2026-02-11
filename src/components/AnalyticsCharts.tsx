'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';

interface EventDayData {
  day: string;
  pageViews: number;
  uniqueSessions: number;
}

interface TabData {
  tab: string;
  count: number;
}

interface AnalyticsChartsProps {
  eventsOverTime: EventDayData[];
  tabUsage: TabData[];
  tourComplete: number;
  tourSkip: number;
}

const TAB_COLORS: Record<string, string> = {
  majors: '#f59e0b',
  colleges: '#16a34a',
};

export default function AnalyticsCharts({
  eventsOverTime,
  tabUsage,
  tourComplete,
  tourSkip,
}: AnalyticsChartsProps) {
  const tourData = [
    { label: 'Completed', value: tourComplete, color: '#16a34a' },
    { label: 'Skipped', value: tourSkip, color: '#dc2626' },
  ];

  return (
    <div className="mt-8 space-y-8">
      {eventsOverTime.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Events Over Time</h2>
          <div className="rounded-lg border border-gray-100 bg-card p-4">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={eventsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="pageViews" name="Page Views" fill="#2563eb" radius={[2, 2, 0, 0]} />
                <Bar dataKey="uniqueSessions" name="Sessions" fill="#16a34a" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {tabUsage.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-text-primary">Tab Usage</h2>
            <div className="rounded-lg border border-gray-100 bg-card p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={tabUsage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="tab"
                    tick={{ fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip />
                  <Bar dataKey="count" name="Switches" radius={[0, 2, 2, 0]}>
                    {tabUsage.map((entry) => (
                      <Cell
                        key={entry.tab}
                        fill={TAB_COLORS[entry.tab] ?? '#6b7280'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {(tourComplete > 0 || tourSkip > 0) && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-text-primary">Tour Completion</h2>
            <div className="rounded-lg border border-gray-100 bg-card p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={tourData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Count" radius={[2, 2, 0, 0]}>
                    {tourData.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
