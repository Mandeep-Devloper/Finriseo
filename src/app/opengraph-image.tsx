import { ImageResponse } from 'next/og';
export const runtime = 'edge';
export const alt = 'Finriseo — Compare Loans from 50+ NBFCs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: 'linear-gradient(135deg, #052e16 0%, #0B4D2C 50%, #166534 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Background pattern circles */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400,
          borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: -80, right: 100, width: 300, height: 300,
          borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex' }} />

        {/* Badge */}
        <div style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 40, padding: '10px 24px', marginBottom: 32, display: 'flex' }}>
          <span style={{ color: '#86efac', fontSize: 16, fontWeight: 600 }}>
            🇮🇳 RBI Registered NBFC Partners
          </span>
        </div>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, background: '#22c55e', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 28, fontWeight: 900 }}>F</div>
          <span style={{ color: 'white', fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>
            Finriseo
          </span>
        </div>

        {/* Headline */}
        <h1 style={{ color: 'white', fontSize: 64, fontWeight: 900, lineHeight: 1.1,
          margin: 0, marginBottom: 24, letterSpacing: -2, maxWidth: 800 }}>
          Compare Loans from
          <span style={{ color: '#4ade80' }}> 50+ NBFCs</span>
        </h1>

        {/* Subtext */}
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 24, margin: 0, marginBottom: 48 }}>
          Instant approval • Zero paperwork • Best rates guaranteed
        </p>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 48 }}>
          {[['2L+', 'Customers'], ['₹500Cr+', 'Disbursed'], ['50+', 'NBFC Partners'], ['4.8★', 'Rating']].map(([val, label]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: '#4ade80', fontSize: 28, fontWeight: 800 }}>{val}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* URL */}
        <div style={{ position: 'absolute', bottom: 40, right: 80,
          color: 'rgba(255,255,255,0.4)', fontSize: 18 }}>
          finriseo.com
        </div>
      </div>
    ),
    { ...size }
  );
}
