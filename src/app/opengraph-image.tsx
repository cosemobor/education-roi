import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Higher Education Outcomes - College Earnings Explorer';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
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
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: 'rgba(255,255,255,0.2)',
              padding: '8px 20px',
              borderRadius: '12px',
            }}
          >
            HEO
          </div>
        </div>
        <div
          style={{
            fontSize: '56px',
            fontWeight: 800,
            lineHeight: 1.1,
            textAlign: 'center',
            letterSpacing: '-0.02em',
            marginBottom: '24px',
          }}
        >
          Higher Education Outcomes
        </div>
        <div
          style={{
            fontSize: '24px',
            opacity: 0.85,
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: 1.4,
            marginBottom: '48px',
          }}
        >
          Explore earnings outcomes by college major and school using College Scorecard data
        </div>
        <div
          style={{
            display: 'flex',
            gap: '40px',
            fontSize: '20px',
            opacity: 0.7,
          }}
        >
          <span>4,000+ Programs</span>
          <span>·</span>
          <span>800+ Schools</span>
          <span>·</span>
          <span>College Scorecard Data</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
