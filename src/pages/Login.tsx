// src/pages/Login.tsx
// Project Sennzo — Login page.
// Email + password → Supabase Auth → role from app_metadata → redirect.

import { useState, FormEvent } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAuth }             from '../contexts/AuthContext';

const T = {
  bg:     '#0d0d0d',
  card:   '#111',
  border: '#1e1e1e',
  gold:   '#E8B84B',
  dim:    '#555',
  text:   '#ccc',
  error:  '#ef4444',
};

export default function Login() {
  const { signIn, role, loading } = useAuth();
  const navigate                  = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [errMsg,   setErrMsg]   = useState('');
  const [busy,     setBusy]     = useState(false);

  // Already authenticated → redirect based on role
  if (!loading && role) {
    if      (role === 'enzo')   navigate('/cockpit', { replace: true });
    else if (role === 'parent') navigate('/parent',  { replace: true });
    else if (role === 'coach')  navigate('/parent',  { replace: true });
    else                         navigate('/',        { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrMsg('');
    setBusy(true);

    const err = await signIn(email.trim(), password);
    setBusy(false);

    if (err) {
      setErrMsg(err);
      return;
    }

    // onAuthStateChange in AuthContext handles the role + sessionStorage sync.
    // Wait one tick then let the already-logged-in redirect above fire.
  };

  return (
    <div style={{
      background: T.bg, minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Mono', monospace",
    }}>
      <div style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 10, padding: '40px 48px', width: 360,
      }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, color: T.dim, letterSpacing: '0.2em',
            textTransform: 'uppercase', marginBottom: 8 }}>
            Project Sennzo
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
            Sign in
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 10, color: T.dim,
              letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0d0d0d', border: `1px solid ${T.border}`,
                borderRadius: 4, color: '#fff', fontFamily: 'inherit',
                fontSize: 13, padding: '10px 12px', outline: 'none',
              }}
              onFocus={e  => (e.currentTarget.style.borderColor = T.gold)}
              onBlur={e   => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 10, color: T.dim,
              letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0d0d0d', border: `1px solid ${T.border}`,
                borderRadius: 4, color: '#fff', fontFamily: 'inherit',
                fontSize: 13, padding: '10px 12px', outline: 'none',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = T.gold)}
              onBlur={e  => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>

          {errMsg && (
            <div style={{
              background: '#1c0808', border: `1px solid ${T.error}`,
              borderRadius: 4, padding: '10px 12px', marginBottom: 16,
              fontSize: 12, color: T.error,
            }}>
              {errMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || loading}
            style={{
              width: '100%', background: T.gold, border: 'none',
              borderRadius: 4, color: '#000', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', padding: '12px', cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

        <div style={{ marginTop: 24, fontSize: 11, color: T.dim, textAlign: 'center', lineHeight: 1.6 }}>
          Access is by invitation only.<br />
          Contact Mark to get your credentials.
        </div>
      </div>
    </div>
  );
}
