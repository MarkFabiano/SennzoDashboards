import { useNavigate } from 'react-router-dom';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div>
      <div style={{
        background: '#080808', borderBottom: '1px solid #1a1a1a',
        padding: '10px 40px', display: 'flex', alignItems: 'center',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: '#555',
            cursor: 'pointer', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'inherit' }}
        >
          ← All Dashboards
        </button>
      </div>
      {children}
    </div>
  );
}
