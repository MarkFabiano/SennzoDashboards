// src/components/ProtectedRoute.tsx
// Route guard for Project Sennzo (Prompt #21).
//
// Behaviour:
//   loading         → spinner (auth session resolving)
//   no user + no dev role → redirect to /login
//   user with role  → render children
//   auto-redirect on / based on role (coach/parent → /parent, enzo → /cockpit)
//
// Erika (parent role): Portal B already gate-keeps the "Enzo Summary" tab.
// Mark (coach role):   Full Portal B access + driver mode toggle.

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth }               from '../contexts/AuthContext';

// ── Loading spinner ───────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{
      background: '#0d0d0d', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Mono', monospace", color: '#333', fontSize: 12,
    }}>
      Loading…
    </div>
  );
}

// ── Main guard ────────────────────────────────────────────────────────────────
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const location                = useLocation();

  if (loading) return <Spinner />;

  // Not authenticated and no dev fallback → login
  if (!user && !role) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Auto-redirect on root '/' based on role
  if (location.pathname === '/') {
    if (role === 'enzo')                  return <Navigate to="/cockpit" replace />;
    if (role === 'parent' || role === 'coach') return <Navigate to="/parent"  replace />;
  }

  return <>{children}</>;
}
