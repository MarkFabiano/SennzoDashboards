import { useNavigate } from 'react-router-dom';

const DASHBOARDS = [
  {
    route: '/live',
    title: 'Portal C — Live Coaching Overlay',
    description: 'Real-time telemetry chart, emotion state, coaching events. Coach/parent view during sessions.',
    version: 'v1',
    date: '2026-05-23',
  },
  {
    route: '/multi-user-plan',
    title: 'Multiple Users + Go-Karting',
    description: 'Access matrix, user tiers, Module 13 plan, build phases, decision log.',
    version: 'v3',
    date: '2026-05-22',
  },
  // Cowork adds entries here as new dashboards arrive
];

export default function Home() {
  const navigate = useNavigate();
  return (
    <div style={{ background: '#0d0d0d', minHeight: '100vh', padding: '40px', fontFamily: "'DM Mono', monospace" }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Project Sennzo</div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.03em' }}>Dashboards</h1>
        <p style={{ color: '#444', fontSize: 13, marginTop: 8 }}>{DASHBOARDS.length} dashboard{DASHBOARDS.length !== 1 ? 's' : ''} available</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {DASHBOARDS.map(d => (
          <div
            key={d.route}
            onClick={() => navigate(d.route)}
            style={{
              background: '#111', border: '1px solid #1e1e1e', borderRadius: 8,
              padding: '20px 24px', cursor: 'pointer', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#E8B84B')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e1e')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: '#E8B84B', letterSpacing: '0.12em', textTransform: 'uppercase',
                background: '#E8B84B15', border: '1px solid #E8B84B33', borderRadius: 3, padding: '2px 8px' }}>
                {d.version}
              </span>
              <span style={{ fontSize: 10, color: '#333' }}>{d.date}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{d.title}</div>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>{d.description}</div>
            <div style={{ marginTop: 16, fontSize: 11, color: '#E8B84B', letterSpacing: '0.1em' }}>OPEN →</div>
          </div>
        ))}
      </div>
    </div>
  );
}
