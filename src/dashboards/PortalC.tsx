// src/dashboards/PortalC.tsx
// Project Sennzo — Portal C: Live Coaching Overlay
//
// Real-time view for Mark during every driving session.
// Shows: live telemetry chart, emotion state, coaching feed, sector times.
// Accessible to parent / coach roles only.
// Subscribes to three Supabase Realtime broadcast channels:
//   telemetry  — 5Hz samples from TIS normaliser
//   coaching   — coaching events from diagnosis engine
//   emotion    — emotion state from Hume EVI

import { useEffect, useRef, useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { createClient } from '@supabase/supabase-js';
import { DashboardShell } from '../components/DashboardShell';

// ── Supabase anon client (read-only, broadcast subscription only) ─────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL     ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
);

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_SAMPLES = 300;
const COACHING_MAX = 50;

// ── Types ─────────────────────────────────────────────────────────────────────
type CoachingState = 'calm' | 'excited' | 'confident' | 'hesitant' | 'withdrawn' | 'frustrated';

interface ChartSample {
  idx:          number;
  speed_kph:    number;
  throttle_pct: number;
  brake_pct:    number;
  is_corner:    boolean;
}

interface CoachingEntry {
  id:           string;
  corner_id:    string;
  corner_name:  string;
  pattern_name: string;
  description:  string;
  flag:         'error' | 'positive' | 'info';
  priority:     'high' | 'medium' | 'low';
  recurrence:   number;
  kb_note:      string | null;
  audio_url?:   string;
  timestamp:    number;
}

interface EmotionSnap {
  state:     CoachingState;
  timestamp: number;
}

interface SectorSplits {
  s1: number | null;
  s2: number | null;
  s3: number | null;
}

// ── Emotion config ─────────────────────────────────────────────────────────────
const EMOTION: Record<CoachingState, { icon: string; color: string; label: string }> = {
  calm:       { icon: '🔵', color: '#3b82f6', label: 'Calm'      },
  excited:    { icon: '🟡', color: '#eab308', label: 'Excited'   },
  confident:  { icon: '🟢', color: '#22c55e', label: 'Confident' },
  hesitant:   { icon: '🟠', color: '#f97316', label: 'Hesitant'  },
  withdrawn:  { icon: '⚫', color: '#6b7280', label: 'Withdrawn' },
  frustrated: { icon: '🔴', color: '#ef4444', label: 'Frustrated'},
};

const FLAG_STYLE: Record<string, { bg: string; border: string }> = {
  error:    { bg: '#1c0808', border: '#ef4444' },
  positive: { bg: '#081c0e', border: '#22c55e' },
  info:     { bg: '#111',    border: '#2a2a2a'  },
};

// ── CSS injected into <head> ───────────────────────────────────────────────────
const PORTAL_CSS = `
  @keyframes live-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 4px #22c55e; }
    50% { opacity: 0.35; box-shadow: none; }
  }
  @keyframes frustrated-pulse {
    0%, 100% { border-color: #ef4444; }
    50% { border-color: #7f1d1d; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function LiveHeader({
  connected, lapNumber, trackName,
}: { connected: boolean; lapNumber: number; trackName: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      paddingBottom: 12, borderBottom: '1px solid #1a1a1a', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: connected ? '#22c55e' : '#444',
          animation: connected ? 'live-dot 2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: 10, color: connected ? '#22c55e' : '#444', letterSpacing: '0.15em' }}>
          {connected ? 'LIVE SESSION' : 'OFFLINE'}
        </span>
      </div>
      {lapNumber > 0 && (
        <span style={{ fontSize: 10, color: '#555' }}>Lap {lapNumber}</span>
      )}
      {trackName && (
        <span style={{ fontSize: 10, color: '#555' }}>{trackName}</span>
      )}
      <div style={{ marginLeft: 'auto', fontSize: 10, color: '#333', letterSpacing: '0.1em' }}>
        COACH VIEW
      </div>
    </div>
  );
}

function EmotionDisplay({ snap }: { snap: EmotionSnap | null }) {
  const cfg  = snap ? (EMOTION[snap.state] ?? EMOTION.calm) : EMOTION.calm;
  const isFr = snap?.state === 'frustrated';
  const ageS = snap ? Math.round((Date.now() - snap.timestamp) / 1000) : null;

  return (
    <div style={{
      background: '#0f0f0f',
      border: `1px solid ${isFr ? '#ef4444' : '#1e1e1e'}`,
      borderRadius: 6, padding: '14px 16px',
      animation: isFr ? 'frustrated-pulse 1s ease-in-out infinite' : 'none',
    }}>
      <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
        Emotion State
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 32, lineHeight: 1 }}>{cfg.icon}</span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
          <div style={{ fontSize: 10, color: '#444', marginTop: 3 }}>
            {ageS === null ? 'No data yet'
              : ageS < 2 ? 'just now'
              : `updated ${ageS}s ago`}
          </div>
        </div>
      </div>
    </div>
  );
}

function LapPanel({
  lapNumber, trackName, splits,
}: { lapNumber: number; trackName: string; splits: SectorSplits }) {
  const fmtMs = (ms: number | null) =>
    ms === null ? '—' : (ms / 1000).toFixed(3) + 's';

  return (
    <div style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 6, padding: '14px 16px' }}>
      <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>
        Session
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
        {lapNumber > 0 ? `Lap ${lapNumber}` : '—'}
      </div>
      <div style={{ fontSize: 11, color: '#333', marginBottom: 14 }}>
        {trackName || 'Waiting for telemetry...'}
      </div>

      <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
        Sector Splits
      </div>
      {(['s1', 's2', 's3'] as const).map((s, i) => (
        <div key={s} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#555' }}>S{i + 1}</span>
          <span style={{ fontSize: 11, color: splits[s] ? '#ccc' : '#2a2a2a', fontVariantNumeric: 'tabular-nums' }}>
            {fmtMs(splits[s])}
          </span>
        </div>
      ))}
    </div>
  );
}

function TelemetryChart({ samples }: { samples: ChartSample[] }) {
  const corners = samples.filter(s => s.is_corner).map(s => s.idx);

  return (
    <div style={{ width: '100%', height: 210 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={samples} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#151515" vertical={false} />
          <XAxis dataKey="idx" hide />
          <YAxis yAxisId="spd" domain={[0, 360]} tick={{ fill: '#333', fontSize: 8 }} />
          <YAxis yAxisId="pct" orientation="right" domain={[0, 105]} tick={{ fill: '#333', fontSize: 8 }} />
          {corners.map(x => (
            <ReferenceLine key={x} x={x} yAxisId="spd"
              stroke="#E8B84B" strokeDasharray="3 4" strokeWidth={1} />
          ))}
          <Line yAxisId="spd" type="monotone" dataKey="speed_kph"
            stroke="#ffffff" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line yAxisId="pct" type="monotone" dataKey="throttle_pct"
            stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line yAxisId="pct" type="monotone" dataKey="brake_pct"
            stroke="#ef4444" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function CoachingFeed({ entries, isCoach }: { entries: CoachingEntry[]; isCoach: boolean }) {
  const flagEntries = entries.filter(e => e.recurrence >= 2 && e.flag === 'error');

  return (
    <div style={{
      background: '#0f0f0f', border: '1px solid #1e1e1e',
      borderRadius: 6, padding: '14px 16px',
      height: '100%', overflowY: 'auto', minHeight: 200,
    }}>
      <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>
        Coaching Feed
      </div>

      {entries.length === 0 ? (
        <div style={{ fontSize: 11, color: '#2a2a2a', fontStyle: 'italic' }}>
          Waiting for coaching events...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.slice(0, 20).map(e => {
            const fs = FLAG_STYLE[e.flag] ?? FLAG_STYLE.info;
            return (
              <div key={e.id} style={{
                background: fs.bg,
                border: `1px solid ${fs.border}44`,
                borderRadius: 4, padding: '8px 12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: fs.border, letterSpacing: '0.08em' }}>
                    [{e.corner_id}] {e.pattern_name}
                  </span>
                  <span style={{ fontSize: 9, color: '#2a2a2a' }}>
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#bbb', lineHeight: 1.5 }}>
                  {e.description || 'Corner analysed'}
                </div>
                {e.kb_note && (
                  <div style={{ fontSize: 10, color: '#E8B84B', marginTop: 5 }}>⚠ {e.kb_note}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Flags for Mark — coach/parent only (SECRET) */}
      {isCoach && flagEntries.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 9, color: '#E8B84B', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
            Flags for Mark
          </div>
          {flagEntries.map(e => (
            <div key={`flag-${e.id}`} style={{ fontSize: 11, color: '#E8B84B', marginBottom: 5 }}>
              ⚠ {e.corner_name}: repeating {e.recurrence}× this session
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Role gate ─────────────────────────────────────────────────────────────────
function RoleGate({ onSelect }: { onSelect: (r: string) => void }) {
  const pick = (r: string) => {
    sessionStorage.setItem('sennzo_role', r);
    onSelect(r);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0d0d0d',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Mono', monospace",
    }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 10, color: '#444', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
          Project Sennzo
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>Portal C</h2>
        <p style={{ color: '#444', fontSize: 12, marginBottom: 32 }}>Live Coaching Overlay</p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {[
            { role: 'parent', label: '👨‍👦 Mark (Parent)' },
            { role: 'coach',  label: '🎓 Coach'          },
          ].map(({ role, label }) => (
            <button
              key={role}
              onClick={() => pick(role)}
              style={{
                background: '#111', border: '1px solid #2a2a2a', borderRadius: 6,
                padding: '12px 22px', color: '#fff', cursor: 'pointer',
                fontSize: 13, fontFamily: 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#E8B84B')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => pick('enzo')}
          style={{
            marginTop: 18, background: 'none', border: 'none',
            color: '#2a2a2a', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
          }}
        >
          Enzo (Driver)
        </button>
      </div>
    </div>
  );
}

// ── ReggieAudio — hidden audio player for TTS coaching lines ─────────────────
function ReggieAudio({ entries }: { entries: CoachingEntry[] }) {
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const lastIdRef = useRef('');

  useEffect(() => {
    const latest = entries[0];
    if (!latest || latest.id === lastIdRef.current || !latest.audio_url) return;
    lastIdRef.current = latest.id;
    if (audioRef.current) {
      audioRef.current.src = latest.audio_url;
      audioRef.current.play().catch(() => {});
    }
  }, [entries]);

  return <audio ref={audioRef} style={{ display: 'none' }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Portal C component
// ─────────────────────────────────────────────────────────────────────────────
export default function PortalC() {
  // ── All hooks declared unconditionally ────────────────────────────────────
  const [role,      setRole]      = useState<string>(() => sessionStorage.getItem('sennzo_role') ?? '');
  const [connected, setConnected] = useState(false);
  const [samples,   setSamples]   = useState<ChartSample[]>([]);
  const [emotion,   setEmotion]   = useState<EmotionSnap | null>(null);
  const [coaching,  setCoaching]  = useState<CoachingEntry[]>([]);
  const [lapNumber, setLapNumber] = useState(0);
  const [trackName, setTrackName] = useState('');
  const [splits,    setSplits]    = useState<SectorSplits>({ s1: null, s2: null, s3: null });

  const idxRef     = useRef(0);
  const prevSector = useRef(0);
  const s1TimeRef  = useRef<number | null>(null);

  // Realtime subscriptions — active only for parent/coach
  useEffect(() => {
    const isCoach = role === 'parent' || role === 'coach';
    if (!isCoach) return;

    // ── Telemetry channel ─────────────────────────────────────────────────
    const telCh = supabase
      .channel('telemetry')
      .on('broadcast', { event: 'sample' }, ({ payload }: { payload: Record<string, any> }) => {
        setConnected(true);

        // Lap number + track name
        if (payload.lap_number) setLapNumber(payload.lap_number as number);
        if (payload.track_name) setTrackName(payload.track_name as string);

        // Sector split tracking (using lap_time_ms for accuracy)
        const curSec = (payload.sector as number) ?? 0;
        const lapMs  = (payload.lap_time_ms as number) ?? 0;
        if (curSec && curSec !== prevSector.current) {
          if (prevSector.current === 1 && curSec === 2) {
            s1TimeRef.current = lapMs;
            setSplits(p => ({ ...p, s1: lapMs }));
          } else if (prevSector.current === 2 && curSec === 3) {
            const s2 = s1TimeRef.current !== null ? lapMs - s1TimeRef.current : null;
            setSplits(p => ({ ...p, s2 }));
          } else if (curSec === 1) {
            // New lap
            s1TimeRef.current = null;
            setSplits({ s1: null, s2: null, s3: null });
          }
          prevSector.current = curSec;
        }

        const sample: ChartSample = {
          idx:          idxRef.current++,
          speed_kph:    (payload.speed_kph    as number) ?? 0,
          throttle_pct: (payload.throttle_pct as number) ?? 0,
          brake_pct:    (payload.brake_pct    as number) ?? 0,
          is_corner:    false,
        };
        setSamples(prev => [...prev.slice(-(MAX_SAMPLES - 1)), sample]);
      })
      .on('broadcast', { event: 'corner_start' }, () => {
        // Tag the latest sample as a corner entry (for chart marker)
        setSamples(prev => {
          if (!prev.length) return prev;
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], is_corner: true };
          return next;
        });
      })
      .subscribe();

    // ── Coaching channel ──────────────────────────────────────────────────
    const coachCh = supabase
      .channel('coaching')
      .on('broadcast', { event: 'coaching_audio' }, ({ payload }: { payload: Record<string, any> }) => {
        const entry: CoachingEntry = {
          id:           `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          corner_id:    (payload.corner_id    as string) ?? '—',
          corner_name:  (payload.corner_name  as string) ?? '—',
          pattern_name: (payload.pattern_name as string) ?? 'unknown',
          description:  (payload.description  as string) ?? '',
          flag:         (payload.flag         as 'error' | 'positive' | 'info') ?? 'info',
          priority:     (payload.priority     as 'high' | 'medium' | 'low') ?? 'low',
          recurrence:   (payload.recurrence   as number) ?? 1,
          kb_note:      (payload.kb_note      as string | null) ?? null,
          audio_url:    (payload.audio_url    as string | undefined),
          timestamp:    Date.now(),
        };
        setCoaching(prev => [entry, ...prev].slice(0, COACHING_MAX));
      })
      .subscribe();

    // ── Emotion channel ───────────────────────────────────────────────────
    const emojiCh = supabase
      .channel('emotion')
      .on('broadcast', { event: 'emotion_update' }, ({ payload }: { payload: Record<string, any> }) => {
        if (payload.state) {
          setEmotion({ state: payload.state as CoachingState, timestamp: Date.now() });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(telCh);
      supabase.removeChannel(coachCh);
      supabase.removeChannel(emojiCh);
      setConnected(false);
    };
  }, [role]);

  // ── Conditional renders — all hooks already called above ──────────────────
  if (!role) {
    return <RoleGate onSelect={setRole} />;
  }

  if (role === 'enzo') {
    return (
      <DashboardShell>
        <div style={{
          padding: '80px 40px', textAlign: 'center',
          fontFamily: "'DM Mono', monospace",
        }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🚫</div>
          <div style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>Coach-only view</div>
          <div style={{ fontSize: 12, color: '#555' }}>
            The Live Coaching Overlay is for Mark and coaches only.
          </div>
          <button
            onClick={() => { sessionStorage.removeItem('sennzo_role'); setRole(''); }}
            style={{
              marginTop: 24, background: 'none', border: '1px solid #2a2a2a',
              color: '#555', cursor: 'pointer', padding: '8px 16px',
              borderRadius: 4, fontSize: 11, fontFamily: 'inherit',
            }}
          >
            Switch role
          </button>
        </div>
      </DashboardShell>
    );
  }

  const isCoach = role === 'parent' || role === 'coach';

  return (
    <DashboardShell>
      <style>{PORTAL_CSS}</style>
      <ReggieAudio entries={coaching} />

      <div style={{
        background: '#0d0d0d', minHeight: 'calc(100vh - 41px)',
        padding: '18px 22px', fontFamily: "'DM Mono', monospace",
      }}>
        <LiveHeader connected={connected} lapNumber={lapNumber} trackName={trackName} />

        {/* ── Main grid ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          gridTemplateRows: 'auto auto',
          gap: 10,
        }}>

          {/* Col 1 Row 1 — Emotion */}
          <EmotionDisplay snap={isCoach ? emotion : null} />

          {/* Col 2 Row 1 — Telemetry chart */}
          <div style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 6, padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 9, color: '#444', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                Telemetry — Last {MAX_SAMPLES / 10}s
              </span>
              <div style={{ display: 'flex', gap: 14, fontSize: 9 }}>
                <span style={{ color: '#888' }}>— Speed</span>
                <span style={{ color: '#22c55e' }}>— Throttle</span>
                <span style={{ color: '#ef4444' }}>— Brake</span>
                <span style={{ color: '#E8B84B' }}>| Corner</span>
              </div>
            </div>
            <TelemetryChart samples={samples} />
          </div>

          {/* Col 1 Row 2 — Lap / Sector */}
          <LapPanel lapNumber={lapNumber} trackName={trackName} splits={splits} />

          {/* Col 2 Row 2 — Coaching feed */}
          <CoachingFeed entries={coaching} isCoach={isCoach} />
        </div>

        {/* Role switcher (small) */}
        <div style={{ marginTop: 14, textAlign: 'right' }}>
          <button
            onClick={() => { sessionStorage.removeItem('sennzo_role'); setRole(''); }}
            style={{
              background: 'none', border: 'none', color: '#2a2a2a',
              cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
            }}
          >
            Switch role
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}
