import { ImageResponse } from 'next/og';
import { getDb } from '@/lib/db';
import { majorsSummary } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'edge';
export const alt = 'Major Earnings Data';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({ params }: { params: Promise<{ cipCode: string }> }) {
  const { cipCode } = await params;
  const db = getDb();
  const [row] = await db
    .select({
      cipTitle: majorsSummary.cipTitle,
      medianEarn1yr: majorsSummary.medianEarn1yr,
      medianEarn5yr: majorsSummary.medianEarn5yr,
      schoolCount: majorsSummary.schoolCount,
    })
    .from(majorsSummary)
    .where(eq(majorsSummary.cipCode, cipCode))
    .limit(1);

  const title = row?.cipTitle?.replace(/\.+$/, '') ?? 'Major';
  const earn1yr = row?.medianEarn1yr ? `$${Math.round(row.medianEarn1yr).toLocaleString()}` : null;
  const earn5yr = row?.medianEarn5yr ? `$${Math.round(row.medianEarn5yr).toLocaleString()}` : null;
  const schools = row?.schoolCount ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #1e40af 100%)',
          fontFamily: 'system-ui, sans-serif',
          color: '#ffffff',
          padding: '60px',
        }}
      >
        <div
          style={{
            fontSize: '24px',
            fontWeight: 700,
            opacity: 0.7,
            marginBottom: '16px',
            background: 'rgba(255,255,255,0.15)',
            padding: '6px 16px',
            borderRadius: '8px',
          }}
        >
          HEO · Major
        </div>
        <div
          style={{
            fontSize: '52px',
            fontWeight: 800,
            lineHeight: 1.1,
            textAlign: 'center',
            letterSpacing: '-0.02em',
            marginBottom: '40px',
            maxWidth: '900px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            gap: '48px',
            fontSize: '22px',
          }}
        >
          {earn1yr && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ opacity: 0.7 }}>Median 1yr</span>
              <span style={{ fontSize: '36px', fontWeight: 800 }}>{earn1yr}</span>
            </div>
          )}
          {earn5yr && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ opacity: 0.7 }}>Median 5yr</span>
              <span style={{ fontSize: '36px', fontWeight: 800 }}>{earn5yr}</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span style={{ opacity: 0.7 }}>Schools</span>
            <span style={{ fontSize: '36px', fontWeight: 800 }}>{schools}</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
