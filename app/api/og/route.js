import { ImageResponse } from 'next/og';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') || 'SteamVault';
  const games = searchParams.get('games') || '0';
  const hours = searchParams.get('hours') || '0';
  const value = searchParams.get('value') || '₹0';
  const unplayed = searchParams.get('unplayed') || '0%';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0d121e',
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(125, 211, 252, 0.22), transparent 50%), radial-gradient(circle at 80% 80%, rgba(196, 181, 253, 0.22), transparent 50%)',
          padding: '60px',
          color: '#f1f5f9',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #7dd3fc, #c4b5fd)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f172a',
              fontWeight: 900,
              fontSize: '22px',
            }}
          >
            SV
          </div>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#cbd5e1' }}>
            SteamVault Analytics
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontSize: '24px', color: '#7dd3fc', fontWeight: 600 }}>
            STEAM LIBRARY REPORT
          </span>
          <span style={{ fontSize: '64px', fontWeight: 800, color: '#ffffff' }}>
            {name}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '28px' }}>
          {[
            { label: 'EST. VALUE', val: value, color: '#6ee7b7' },
            { label: 'GAMES OWNED', val: games, color: '#f8fafc' },
            { label: 'HOURS PLAYED', val: `${hours}h`, color: '#7dd3fc' },
            { label: 'UNPLAYED', val: unplayed, color: '#fda4af' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '20px',
                padding: '22px 30px',
                flex: 1,
              }}
            >
              <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 600 }}>
                {stat.label}
              </span>
              <span
                style={{
                  fontSize: '36px',
                  fontWeight: 800,
                  color: stat.color,
                  marginTop: '6px',
                }}
              >
                {stat.val}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}