// src/dashboards/PortalB.tsx
// Project Sennzo — Portal B: Parent Command Centre
//
// Mark's (and Erika's) window into the program.
// Tabs: Home (driver cards + news) / Sessions / Behavioral (SECRET) /
//       Hardware / Roadmap / Enzo Summary
//
// Role gate: parent + coach = full access.
//            viewer = Enzo Summary only.
//            enzo   = access denied.

import { useEffect, useRef, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { createClient } from '@supabase/supabase-js';
import { DashboardShell } from '../components/DashboardShell';

// ── Supabase client ─────────────────────────────────────────────────────────
const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL     ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
);

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'home' | 'sessions' | 'behavioral' | 'hardware' | 'roadmap' | 'enzo-summary';

interface DriverProfile {
  id: string;
  full_name: string;
  diagnosis?: string;
  learning_style?: string;
}
interface Session {
  session_id: string;
  session_date: string;
  session_type?: string;
  track_name?: string;
  lap_count?: number;
  best_lap_ms?: number;
  mood_at_start?: string;
  mood_at_end?: string;
  status?: string;
  actual_duration_mins?: number;
}
interface BehavioralLog {
  id: string;
  session_id?: string;
  mood_at_start?: string;
  mood_at_end?: string;
  frustration_intensity?: number;
  frustration_triggers?: string[];
  burnout_flag?: boolean;
  trust_level?: string;
  full_narrative?: string;
  created_at: string;
}
interface NewsEntry {
  id: string;
  posted_by: string;
  category: string;
  content: string;
  is_read: boolean;
  created_at: string;
}
interface HardwareItem {
  id: string;
  item_name: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  condition?: string;
  notes?: string;
  upgrade_trigger?: string;
}
interface Milestone {
  id: string;
  year: number;
  phase: string;
  milestone_name: string;
  description?: string;
  status: string;
  target_date?: string;
  completion_date?: string;
}

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg:     '#0d0d0d',
  card:   '#0f0f0f',
  border: '#1e1e1e',
  gold:   '#E8B84B',
  dim:    '#444',
  dimmer: '#2a2a2a',
  text:   '#ccc',
};

const PORTAL_B_CSS = `
  @keyframes portal-b-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  .pb-card { animation: portal-b-fade 0.2s ease; }
`;

const FRUSTRATION_COLOR = ['', '#22c55e', '#eab308', '#f97316', '#ef4444'];
const STATUS_COLOR: Record<string, string> = {
  'Not Started': '#333',
  'Active':      '#3b82f6',
  'Completed':   '#22c55e',
  'Skipped':     '#6b7280',
};

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const fmtDate   = (s: string) => new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtLap    = (ms?: number) => ms ? `${(ms / 1000).toFixed(3)}s` : '—';
const labelSty  = { fontSize: 9, color: T.dim, letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8 };

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="pb-card" style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 6, padding: '14px 16px', ...style,
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── Home: Driver cards + News ─────────────────────────────────────────────────
function HomeTab({
  drivers, sessions, news, onMarkRead, onAddNews,
}: {
  drivers: DriverProfile[];
  sessions: Session[];
  news: NewsEntry[];
  onMarkRead: (id: string) => void;
  onAddNews: (entry: { category: string; content: string }) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category: 'School', content: '' });

  // Last session per driver
  const lastSession = sessions[0];
  const daysSinceSession = lastSession
    ? Math.round((Date.now() - new Date(lastSession.session_date).getTime()) / 86400000)
    : null;
  const isActive = daysSinceSession !== null && daysSinceSession <= 7;

  const unread = news.filter(n => !n.is_read);
  const read   = news.filter(n => n.is_read);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {/* Driver cards */}
      <div>
        <div style={labelSty}>Drivers</div>
        {drivers.length === 0 ? (
          <Card><span style={{ fontSize: 11, color: T.dimmer }}>No driver profiles yet</span></Card>
        ) : drivers.map(d => (
          <Card key={d.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{d.full_name}</div>
              <span style={{
                fontSize: 9, color: T.gold, background: '#E8B84B15',
                border: `1px solid ${T.gold}33`, borderRadius: 3, padding: '2px 8px', letterSpacing: '0.1em',
              }}>Foundation</span>
            </div>
            {lastSession && (
              <div style={{ fontSize: 11, color: T.dim, marginBottom: 6 }}>
                Last session: {fmtDate(lastSession.session_date)}
                {lastSession.track_name ? ` · ${lastSession.track_name}` : ''}
                {lastSession.lap_count ? ` · ${lastSession.lap_count} laps` : ''}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                background: isActive ? '#22c55e' : '#555',
              }} />
              <span style={{ fontSize: 11, color: isActive ? '#22c55e' : '#555' }}>
                {isActive ? 'Active' : daysSinceSession !== null ? `No session in ${daysSinceSession} days` : 'No sessions yet'}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* News board */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={labelSty}>News Board</div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: T.gold, border: 'none', borderRadius: 4,
              padding: '4px 12px', fontSize: 10, color: '#000',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
            }}
          >
            + Add Entry
          </button>
        </div>

        {unread.length === 0 && read.length === 0 && (
          <Card><span style={{ fontSize: 11, color: T.dimmer }}>No entries yet</span></Card>
        )}

        {unread.map(n => (
          <Card key={n.id} style={{ marginBottom: 8, borderColor: '#2a2a2a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: T.gold, letterSpacing: '0.1em' }}>{n.category}</span>
              <span style={{ fontSize: 9, color: T.dimmer }}>{fmtDate(n.created_at)}</span>
            </div>
            <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5, marginBottom: 8 }}>{n.content}</div>
            <button
              onClick={() => onMarkRead(n.id)}
              style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 3, padding: '3px 10px', fontSize: 9, color: T.dim, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Mark read
            </button>
          </Card>
        ))}

        {read.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 10, color: T.dimmer, cursor: 'pointer', marginBottom: 6 }}>
              {read.length} archived
            </summary>
            {read.map(n => (
              <Card key={n.id} style={{ marginBottom: 6, opacity: 0.45 }}>
                <div style={{ fontSize: 10, color: T.dim }}>[{n.category}] {n.content}</div>
              </Card>
            ))}
          </details>
        )}
      </div>

      {/* Add news modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000b', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{ background: '#111', border: `1px solid ${T.border}`, borderRadius: 8, padding: 24, width: 420, fontFamily: 'inherit' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Add News Entry</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: T.dim, marginBottom: 4 }}>Category</div>
              <select
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${T.border}`, borderRadius: 4, padding: '8px', color: '#fff', fontFamily: 'inherit', fontSize: 12 }}
              >
                {['School', 'Social', 'Home', 'Health', 'Other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: T.dim, marginBottom: 4 }}>Note</div>
              <textarea
                value={form.content}
                onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                rows={4}
                style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${T.border}`, borderRadius: 4, padding: 8, color: '#fff', fontFamily: 'inherit', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
                placeholder="What should Reggie know before this session?"
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, padding: '8px 16px', color: T.dim, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>Cancel</button>
              <button
                onClick={() => {
                  if (form.content.trim()) {
                    onAddNews(form);
                    setForm({ category: 'School', content: '' });
                    setShowModal(false);
                  }
                }}
                style={{ background: T.gold, border: 'none', borderRadius: 4, padding: '8px 16px', color: '#000', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700 }}
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sessions tab ──────────────────────────────────────────────────────────────
function SessionsTab({ sessions }: { sessions: Session[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div>
      <div style={labelSty}>Session History ({sessions.length})</div>
      {sessions.length === 0 ? (
        <Card><span style={{ fontSize: 11, color: T.dimmer }}>No sessions recorded yet</span></Card>
      ) : (
        <div style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${T.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#111', borderBottom: `1px solid ${T.border}` }}>
                {['Date', 'Track', 'Type', 'Duration', 'Laps', 'Best Lap', 'Mood ↑', 'Mood ↓'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, color: T.dim, letterSpacing: '0.1em', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <>
                  <tr
                    key={s.session_id}
                    onClick={() => setExpanded(expanded === s.session_id ? null : s.session_id)}
                    style={{
                      background: i % 2 === 0 ? T.card : '#111',
                      borderBottom: `1px solid ${T.border}`,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#161616')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? T.card : '#111')}
                  >
                    <td style={{ padding: '9px 10px', color: T.text }}>{fmtDate(s.session_date)}</td>
                    <td style={{ padding: '9px 10px', color: T.text }}>{s.track_name || '—'}</td>
                    <td style={{ padding: '9px 10px', color: T.dim }}>{s.session_type || '—'}</td>
                    <td style={{ padding: '9px 10px', color: T.dim }}>{s.actual_duration_mins ? `${s.actual_duration_mins}m` : '—'}</td>
                    <td style={{ padding: '9px 10px', color: T.dim }}>{s.lap_count ?? '—'}</td>
                    <td style={{ padding: '9px 10px', color: T.text, fontVariantNumeric: 'tabular-nums' }}>{fmtLap(s.best_lap_ms)}</td>
                    <td style={{ padding: '9px 10px', color: T.dim }}>{s.mood_at_start || '—'}</td>
                    <td style={{ padding: '9px 10px', color: T.dim }}>{s.mood_at_end || '—'}</td>
                  </tr>
                  {expanded === s.session_id && (
                    <tr key={`${s.session_id}-exp`} style={{ background: '#0a0a0a' }}>
                      <td colSpan={8} style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: T.dim }}>
                          Session ID: <span style={{ color: T.dimmer }}>{s.session_id}</span>
                        </div>
                        {s.status && <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>Status: {s.status}</div>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Behavioral tab ────────────────────────────────────────────────────────────
function BehavioralTab({ logs }: { logs: BehavioralLog[] }) {
  const last4   = logs.slice(0, 4);
  const burnoutCount = last4.filter(l => l.burnout_flag).length;
  const [expanded, setExpanded] = useState<string | null>(null);

  const chartData = logs.slice(0, 8).reverse().map((l, i) => ({
    name: `S${i + 1}`,
    frustration: l.frustration_intensity ?? 0,
    burnout: l.burnout_flag ? 4 : 0,
  }));

  return (
    <div>
      {/* Burnout alert */}
      {burnoutCount >= 2 && (
        <div style={{
          background: '#2a0808', border: '1px solid #ef4444',
          borderRadius: 6, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>Burnout Alert</div>
            <div style={{ fontSize: 11, color: '#ccc', marginTop: 2 }}>
              Burnout flag raised in {burnoutCount} of last 4 sessions. Consider reducing session frequency or intensity.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Trend chart */}
        <Card>
          <div style={labelSty}>Frustration Trend (last 8 sessions)</div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#151515" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: T.dim, fontSize: 9 }} />
              <YAxis domain={[0, 4]} ticks={[1, 2, 3, 4]} tick={{ fill: T.dim, fontSize: 9 }} />
              <Tooltip
                contentStyle={{ background: '#111', border: `1px solid ${T.border}`, fontSize: 11, fontFamily: 'inherit' }}
                labelStyle={{ color: T.dim }}
              />
              <Line type="monotone" dataKey="frustration" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            {[1, 2, 3, 4].map(n => (
              <div key={n} style={{ fontSize: 9, color: FRUSTRATION_COLOR[n] }}>
                {n} — {['', 'Low', 'Moderate', 'High', 'Severe'][n]}
              </div>
            ))}
          </div>
        </Card>

        {/* Summary stats */}
        <Card>
          <div style={labelSty}>Session Overview</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Total logs', value: logs.length },
              { label: 'Burnout flags', value: logs.filter(l => l.burnout_flag).length },
              { label: 'Avg frustration', value: logs.length ? (logs.reduce((s, l) => s + (l.frustration_intensity ?? 0), 0) / logs.length).toFixed(1) : '—' },
              { label: 'Last 4 burnout', value: `${burnoutCount}/4` },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 9, color: T.dim, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Log entries */}
      <div style={labelSty}>Behavioral Logs</div>
      {logs.length === 0 ? (
        <Card><span style={{ fontSize: 11, color: T.dimmer }}>No behavioral logs yet</span></Card>
      ) : logs.map(l => (
        <Card key={l.id} style={{
          marginBottom: 8,
          borderColor: l.burnout_flag ? '#ef444455' : T.border,
          background: l.burnout_flag ? '#1c0808' : T.card,
        }}>
          <div
            onClick={() => setExpanded(expanded === l.id ? null : l.id)}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {l.frustration_intensity && (
                  <span style={{
                    fontSize: 9, letterSpacing: '0.1em',
                    color: FRUSTRATION_COLOR[l.frustration_intensity] ?? '#fff',
                    background: `${FRUSTRATION_COLOR[l.frustration_intensity]}22`,
                    border: `1px solid ${FRUSTRATION_COLOR[l.frustration_intensity]}44`,
                    borderRadius: 3, padding: '2px 8px',
                  }}>
                    Frustration {l.frustration_intensity}/4
                  </span>
                )}
                {l.burnout_flag && (
                  <span style={{ fontSize: 9, color: '#ef4444', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 3, padding: '2px 8px' }}>
                    BURNOUT FLAG
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: T.dimmer }}>
                {l.mood_at_start && <span>↑ {l.mood_at_start}</span>}
                {l.mood_at_end   && <span>↓ {l.mood_at_end}</span>}
                <span>{fmtDate(l.created_at)}</span>
              </div>
            </div>
            {l.full_narrative && (
              <div style={{ fontSize: 11, color: T.text, lineHeight: 1.5 }}>
                {expanded === l.id ? l.full_narrative : l.full_narrative.slice(0, 100) + (l.full_narrative.length > 100 ? '…' : '')}
              </div>
            )}
          </div>
          {expanded === l.id && l.frustration_triggers && l.frustration_triggers.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 9, color: T.dim, marginBottom: 4 }}>Triggers</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {l.frustration_triggers.map((t, i) => (
                  <span key={i} style={{ fontSize: 10, color: T.dim, background: '#1a1a1a', border: `1px solid ${T.border}`, borderRadius: 3, padding: '2px 8px' }}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Hardware tab ──────────────────────────────────────────────────────────────
function HardwareTab({ items }: { items: HardwareItem[] }) {
  const categories = Array.from(new Set(items.map(i => i.category || 'Other')));
  return (
    <div>
      <div style={labelSty}>Hardware Inventory ({items.length} items)</div>
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{cat}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
            {items.filter(i => (i.category || 'Other') === cat).map(item => (
              <Card key={item.id}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{item.item_name}</div>
                {(item.manufacturer || item.model) && (
                  <div style={{ fontSize: 11, color: T.dim, marginBottom: 6 }}>
                    {[item.manufacturer, item.model].filter(Boolean).join(' ')}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 9, borderRadius: 3, padding: '2px 8px',
                    color: item.condition === 'Good' ? '#22c55e' : T.dim,
                    background: item.condition === 'Good' ? '#22c55e22' : '#1a1a1a',
                    border: `1px solid ${item.condition === 'Good' ? '#22c55e44' : T.border}`,
                  }}>{item.condition || 'Unknown'}</span>
                </div>
                {item.notes && <div style={{ fontSize: 10, color: T.dimmer, marginTop: 6 }}>{item.notes}</div>}
                {item.upgrade_trigger && (
                  <div style={{ fontSize: 10, color: T.gold, marginTop: 6 }}>↑ Upgrade when: {item.upgrade_trigger}</div>
                )}
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Roadmap tab ───────────────────────────────────────────────────────────────
function RoadmapTab({
  milestones, onUpdateStatus,
}: { milestones: Milestone[]; onUpdateStatus: (id: string, status: string) => void }) {
  const years = [1, 2, 3];
  const STATUSES = ['Not Started', 'Active', 'Completed', 'Skipped'];

  return (
    <div>
      <div style={labelSty}>3-Year Training Roadmap</div>
      {years.map(y => {
        const yMs = milestones.filter(m => m.year === y);
        const done = yMs.filter(m => m.status === 'Completed').length;
        return (
          <div key={y} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Year {y}</div>
              <div style={{ fontSize: 10, color: T.dim }}>{done}/{yMs.length} complete</div>
              <div style={{ flex: 1, height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: T.gold, width: `${yMs.length ? (done / yMs.length) * 100 : 0}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {yMs.map(m => (
                <div key={m.id} style={{
                  background: T.card, border: `1px solid ${m.status === 'Completed' ? '#22c55e33' : T.border}`,
                  borderRadius: 6, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: STATUS_COLOR[m.status] ?? T.dimmer,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: m.status === 'Completed' ? '#22c55e' : '#ccc' }}>{m.milestone_name}</div>
                    {m.description && <div style={{ fontSize: 10, color: T.dimmer, marginTop: 2 }}>{m.description}</div>}
                  </div>
                  <select
                    value={m.status}
                    onChange={e => onUpdateStatus(m.id, e.target.value)}
                    style={{ background: '#111', border: `1px solid ${T.border}`, borderRadius: 4, padding: '4px 8px', fontSize: 10, color: T.text, fontFamily: 'inherit', cursor: 'pointer' }}
                  >
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Enzo Summary (Erika's view) ───────────────────────────────────────────────
function EnzoSummaryTab({ sessions }: { sessions: Session[] }) {
  const recent3  = sessions.slice(0, 3);
  const bestLap  = sessions.reduce((best, s) => s.best_lap_ms && (!best || s.best_lap_ms < best.best_lap_ms!) ? s : best, null as Session | null);

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ fontSize: 9, color: T.dim, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
        Enzo's Progress — Summary View
      </div>

      <Card style={{ marginBottom: 12 }}>
        <div style={labelSty}>Latest Personal Best</div>
        {bestLap ? (
          <>
            <div style={{ fontSize: 28, fontWeight: 700, color: T.gold, fontVariantNumeric: 'tabular-nums' }}>
              {fmtLap(bestLap.best_lap_ms)}
            </div>
            <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>
              {bestLap.track_name ? `at ${bestLap.track_name}` : ''} · {fmtDate(bestLap.session_date)}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: T.dimmer }}>No lap time recorded yet</div>
        )}
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={labelSty}>Recent Sessions</div>
        {recent3.length === 0 ? (
          <div style={{ fontSize: 12, color: T.dimmer }}>No sessions yet</div>
        ) : recent3.map(s => (
          <div key={s.session_id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, color: '#fff' }}>{fmtDate(s.session_date)} · {s.track_name || 'Unknown track'}</div>
            <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>
              {s.lap_count ? `${s.lap_count} laps` : ''}
              {s.best_lap_ms ? ` · Best: ${fmtLap(s.best_lap_ms)}` : ''}
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <div style={labelSty}>Upcoming Session</div>
        <div style={{ fontSize: 12, color: T.dimmer }}>No upcoming session scheduled</div>
      </Card>
    </div>
  );
}

// ── Tab navigation ────────────────────────────────────────────────────────────
const TABS: Array<{ id: Tab; label: string; secret?: boolean }> = [
  { id: 'home',         label: 'Home'         },
  { id: 'sessions',     label: 'Sessions'     },
  { id: 'behavioral',   label: 'Behavioral',  secret: true },
  { id: 'hardware',     label: 'Hardware'     },
  { id: 'roadmap',      label: 'Roadmap'      },
  { id: 'enzo-summary', label: 'Enzo Summary' },
];

function TabNav({ active, onSelect, isCoach }: { active: Tab; onSelect: (t: Tab) => void; isCoach: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${T.border}`, marginBottom: 16 }}>
      {TABS.filter(t => isCoach || t.id === 'enzo-summary').map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          style={{
            background: 'none', border: 'none', borderBottom: active === t.id ? `2px solid ${T.gold}` : '2px solid transparent',
            padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 11, color: active === t.id ? T.gold : T.dim,
            marginBottom: -1,
          }}
        >
          {t.label}
          {t.secret && <span style={{ fontSize: 8, color: '#555', marginLeft: 4 }}>SECRET</span>}
        </button>
      ))}
    </div>
  );
}

// ── Role gate ─────────────────────────────────────────────────────────────────
function RoleGate({ onSelect }: { onSelect: (r: string) => void }) {
  const pick = (r: string) => { sessionStorage.setItem('sennzo_role', r); onSelect(r); };
  return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono', monospace" }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 10, color: T.dimmer, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Project Sennzo</div>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>Portal B</h2>
        <p style={{ color: T.dim, fontSize: 12, marginBottom: 32 }}>Parent Command Centre</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {[{ r: 'parent', l: '👨‍👦 Mark (Parent)' }, { r: 'coach', l: '🎓 Coach' }, { r: 'viewer', l: '👩 Erika (Viewer)' }].map(({ r, l }) => (
            <button key={r} onClick={() => pick(r)} style={{ background: '#111', border: `1px solid ${T.dimmer}`, borderRadius: 6, padding: '10px 16px', color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = T.gold)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = T.dimmer)}
            >{l}</button>
          ))}
        </div>
        <button onClick={() => pick('enzo')} style={{ marginTop: 16, background: 'none', border: 'none', color: T.dimmer, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>Enzo (Driver)</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Portal B
// ─────────────────────────────────────────────────────────────────────────────
export default function PortalB() {
  const [role,       setRole]       = useState<string>(() => sessionStorage.getItem('sennzo_role') ?? '');
  const [tab,        setTab]        = useState<Tab>('home');
  const [drivers,    setDrivers]    = useState<DriverProfile[]>([]);
  const [sessions,   setSessions]   = useState<Session[]>([]);
  const [behavioral, setBehavioral] = useState<BehavioralLog[]>([]);
  const [news,       setNews]       = useState<NewsEntry[]>([]);
  const [hardware,   setHardware]   = useState<HardwareItem[]>([]);
  const [roadmap,    setRoadmap]    = useState<Milestone[]>([]);
  const [loading,    setLoading]    = useState(false);

  const loaded = useRef(false);

  useEffect(() => {
    if (!role || role === 'enzo') return;
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);

    Promise.all([
      sb.from('driver_profile').select('id, full_name, diagnosis, learning_style').limit(20),
      sb.from('sessions').select('*').order('session_date', { ascending: false }).limit(50),
      sb.from('behavioral_logs').select('*').order('created_at', { ascending: false }).limit(30),
      sb.from('news_board').select('*').order('created_at', { ascending: false }).limit(30),
      sb.from('hardware_inventory').select('*').order('category'),
      sb.from('training_roadmap').select('*').order('year').order('phase'),
    ]).then(([dr, se, be, ne, hw, rm]) => {
      setDrivers(dr.data as DriverProfile[] ?? []);
      setSessions(se.data as Session[] ?? []);
      setBehavioral(be.data as BehavioralLog[] ?? []);
      setNews(ne.data as NewsEntry[] ?? []);
      setHardware(hw.data as HardwareItem[] ?? []);
      setRoadmap(rm.data as Milestone[] ?? []);
      setLoading(false);
    });
  }, [role]);

  // Viewer → force to enzo-summary
  useEffect(() => { if (role === 'viewer') setTab('enzo-summary'); }, [role]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleMarkRead = async (id: string) => {
    await sb.from('news_board').update({ is_read: true }).eq('id', id);
    setNews(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleAddNews = async (entry: { category: string; content: string }) => {
    const { data } = await sb.from('news_board').insert({ posted_by: 'Mark', category: entry.category, content: entry.content, is_read: false }).select().single();
    if (data) setNews(prev => [data as NewsEntry, ...prev]);
  };

  const handleUpdateMilestone = async (id: string, status: string) => {
    await sb.from('training_roadmap').update({ status }).eq('id', id);
    setRoadmap(prev => prev.map(m => m.id === id ? { ...m, status } : m));
  };

  // ── Conditional renders — all hooks already called ─────────────────────────
  if (!role) return <RoleGate onSelect={setRole} />;

  if (role === 'enzo') {
    return (
      <DashboardShell>
        <div style={{ padding: '80px 40px', textAlign: 'center', fontFamily: "'DM Mono', monospace" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🚫</div>
          <div style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>Parent-only view</div>
          <div style={{ fontSize: 12, color: T.dim }}>Portal B is for Mark, Erika and coaches only.</div>
          <button onClick={() => { sessionStorage.removeItem('sennzo_role'); setRole(''); }} style={{ marginTop: 20, background: 'none', border: `1px solid ${T.border}`, color: T.dim, cursor: 'pointer', padding: '8px 16px', borderRadius: 4, fontSize: 11, fontFamily: 'inherit' }}>Switch role</button>
        </div>
      </DashboardShell>
    );
  }

  const isCoach = role === 'parent' || role === 'coach';

  return (
    <DashboardShell>
      <style>{PORTAL_B_CSS}</style>
      <div style={{ background: T.bg, minHeight: 'calc(100vh - 41px)', padding: '18px 22px', fontFamily: "'DM Mono', monospace" }}>

        {/* Header */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: T.dimmer, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>Project Sennzo</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Parent Command Centre</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {loading && <span style={{ fontSize: 10, color: T.dimmer }}>Loading...</span>}
            <button onClick={() => { sessionStorage.removeItem('sennzo_role'); setRole(''); }} style={{ background: 'none', border: 'none', color: T.dimmer, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>Switch role</button>
          </div>
        </div>

        {/* Tabs */}
        <TabNav active={tab} onSelect={setTab} isCoach={isCoach} />

        {/* Tab content */}
        {tab === 'home' && (
          <HomeTab drivers={drivers} sessions={sessions} news={news} onMarkRead={handleMarkRead} onAddNews={handleAddNews} />
        )}
        {tab === 'sessions' && <SessionsTab sessions={sessions} />}
        {tab === 'behavioral' && isCoach && <BehavioralTab logs={behavioral} />}
        {tab === 'behavioral' && !isCoach && (
          <Card><span style={{ fontSize: 11, color: T.dimmer }}>Access denied — coach/parent only</span></Card>
        )}
        {tab === 'hardware' && <HardwareTab items={hardware} />}
        {tab === 'roadmap' && <RoadmapTab milestones={roadmap} onUpdateStatus={handleUpdateMilestone} />}
        {tab === 'enzo-summary' && <EnzoSummaryTab sessions={sessions} />}
      </div>
    </DashboardShell>
  );
}
