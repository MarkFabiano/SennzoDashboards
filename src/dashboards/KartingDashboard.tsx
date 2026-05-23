// src/dashboards/KartingDashboard.tsx
// Project Sennzo — Module 13: Go-Karting Core
//
// Routes handled (tab-based on URL path):
//   /karting                  — Overview dashboard
//   /karting/races            — Race log + Add Race modal
//   /karting/sessions         — Session log + Add Session modal
//   /karting/kart             — My Kart (hardware + stats)
//   /karting/competition-guide — Static content: 7 sections
//
// All driver tiers have access. Coach sees driver selector.
// Erika (parent) sees Enzo's data read-only.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { createClient } from '@supabase/supabase-js';
import { DashboardShell }  from '../components/DashboardShell';
import { useAuth }         from '../contexts/AuthContext';
import { VideoUpload }     from '../components/VideoUpload';
import { AnalysisPanel }   from '../components/AnalysisPanel';

// ── Supabase ──────────────────────────────────────────────────────────────────
const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL      ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
);

// ── Dev fallback driver_id (Enzo's auth UUID) ─────────────────────────────────
const DEV_DRIVER_ID = 'ff620fef-5990-48d0-9bb6-309cffe0c228';

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg: '#0d0d0d', card: '#0f0f0f', border: '#1e1e1e',
  gold: '#E8B84B', dim: '#444', dimmer: '#2a2a2a', text: '#ccc',
  green: '#22c55e', red: '#ef4444',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface KartRace {
  id: string;
  driver_id: string;
  race_date: string;
  circuit_name: string;
  series_name?: string;
  kart_class?: string;
  grid_position?: number;
  finish_position?: number;
  total_starters?: number;
  best_lap_ms?: number;
  gap_to_winner_ms?: number;
  fastest_lap_in_race?: boolean;
  incidents?: string;
  conditions?: string;
  notes?: string;
  created_at: string;
}

interface KartSession {
  id: string;
  driver_id: string;
  session_date: string;
  circuit_name: string;
  session_type?: string;
  conditions?: string;
  lap_times?: number[];
  notes?: string;
  video_uploaded?: boolean;
  created_at: string;
}

interface CompEntry {
  id: string;
  series_name: string;
  round_number?: number;
  circuit_name?: string;
  event_date?: string;
  kart_class?: string;
  entry_status: string;
  entry_fee_aud?: number;
  notes?: string;
}

interface HardwareItem {
  id: string;
  item_name: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  condition?: string;
  notes?: string;
  purchase_date?: string;
  purchase_price_aud?: number;
}

interface DriverProfile {
  id: string;
  auth_user_id: string;
  display_name: string;
  full_name: string;
}

interface KartVideo {
  id:                    string;
  driver_id:             string;
  kart_session_id:       string | null;
  kart_race_id:          string | null;
  title:                 string | null;
  footage_type:          string | null;
  mux_playback_id:       string | null;
  upload_status:         string;
  analysis_status:       string;
  analysis_result:       unknown | null;
  created_at:            string;
}

// ── Lap time formatter ────────────────────────────────────────────────────────
function fmtLap(ms: number): string {
  if (!ms) return '—';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const c = Math.floor((ms % 1000) / 10);
  return m > 0
    ? `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`
    : `${s}.${String(c).padStart(2, '0')}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Shared components ─────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6,
      padding: '16px 18px', ...style }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: T.dim, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

const STATUS_COLOR: Record<string, string> = {
  planned: '#555', registered: T.gold, confirmed: T.green,
  completed: '#3b82f6', withdrawn: T.red,
};

// ── TAB: Overview ─────────────────────────────────────────────────────────────
function OverviewTab({ races, entries }: { races: KartRace[]; entries: CompEntry[] }) {
  const totalRaces = races.length;
  const bestPos    = races.length > 0
    ? Math.min(...races.filter(r => r.finish_position).map(r => r.finish_position!))
    : '—';
  const bestLap    = races.filter(r => r.best_lap_ms).length > 0
    ? Math.min(...races.filter(r => r.best_lap_ms).map(r => r.best_lap_ms!))
    : null;

  // Season progress chart data
  const chartData = races
    .filter(r => r.finish_position && r.race_date)
    .sort((a, b) => a.race_date.localeCompare(b.race_date))
    .map((r, i) => ({
      race: `R${i + 1}`,
      pos: r.finish_position,
      series: r.series_name ?? 'Race',
    }));

  const maxPos = Math.max(20, ...chartData.map(d => d.pos ?? 0));

  const upcoming = entries
    .filter(e => e.entry_status !== 'completed' && e.entry_status !== 'withdrawn')
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard label="Total Races" value={totalRaces} />
        <StatCard label="Best Result" value={bestPos !== Infinity ? `P${bestPos}` : '—'} />
        <StatCard label="Best Lap" value={bestLap ? fmtLap(bestLap) : '—'} />
        <StatCard label="Upcoming" value={upcoming.length} sub="events" />
      </div>

      {/* Season chart */}
      {chartData.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: T.dim, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
            Season Progress — Finishing Position
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid stroke={T.dimmer} strokeDasharray="3 3" />
              <XAxis dataKey="race" tick={{ fill: T.dim, fontSize: 10 }} />
              <YAxis
                reversed
                domain={[1, maxPos]}
                tick={{ fill: T.dim, fontSize: 10 }}
                label={{ value: 'Pos', angle: -90, position: 'insideLeft', fill: T.dim, fontSize: 9 }}
              />
              <Tooltip
                contentStyle={{ background: '#111', border: `1px solid ${T.border}`, fontSize: 11 }}
                formatter={(v: number) => [`P${v}`, 'Finish']}
              />
              <Line type="monotone" dataKey="pos" stroke={T.gold} strokeWidth={2} dot={{ fill: T.gold, r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Recent races */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: T.dim, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
          Recent Races
        </div>
        {races.length === 0 ? (
          <p style={{ fontSize: 12, color: T.dim, margin: 0 }}>No races recorded yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Date', 'Circuit', 'Series', 'P', 'Best Lap'].map(h => (
                  <th key={h} style={{ textAlign: 'left', color: T.dim, fontSize: 9,
                    letterSpacing: '0.15em', textTransform: 'uppercase', paddingBottom: 8 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {races.slice(0, 5).map(r => (
                <tr key={r.id} style={{ borderTop: `1px solid ${T.dimmer}` }}>
                  <td style={{ padding: '8px 0', color: T.text }}>{fmtDate(r.race_date)}</td>
                  <td style={{ color: T.text }}>{r.circuit_name}</td>
                  <td style={{ color: T.dim }}>{r.series_name ?? '—'}</td>
                  <td style={{ color: r.finish_position === 1 ? T.gold : T.text, fontWeight: r.finish_position === 1 ? 700 : 400 }}>
                    {r.finish_position ? `P${r.finish_position}` : '—'}
                  </td>
                  <td style={{ color: T.text, fontFamily: 'monospace' }}>{r.best_lap_ms ? fmtLap(r.best_lap_ms) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Upcoming entries */}
      <Card>
        <div style={{ fontSize: 10, color: T.dim, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
          Upcoming Competition Entries
        </div>
        {upcoming.length === 0 ? (
          <p style={{ fontSize: 12, color: T.dim, margin: 0 }}>No upcoming entries.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', background: T.bg, borderRadius: 4, border: `1px solid ${T.dimmer}` }}>
                <div>
                  <span style={{ fontSize: 12, color: '#fff' }}>{e.series_name}</span>
                  {e.round_number && <span style={{ fontSize: 10, color: T.dim }}> · Round {e.round_number}</span>}
                  {e.circuit_name && <span style={{ fontSize: 10, color: T.dim }}> · {e.circuit_name}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {e.event_date && <span style={{ fontSize: 10, color: T.dim }}>{fmtDate(e.event_date)}</span>}
                  <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase',
                    letterSpacing: '0.1em', background: `${STATUS_COLOR[e.entry_status]}22`,
                    border: `1px solid ${STATUS_COLOR[e.entry_status]}`, color: STATUS_COLOR[e.entry_status] }}>
                    {e.entry_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── TAB: Races ────────────────────────────────────────────────────────────────
function RacesTab({ races, driverId, onAdded }: { races: KartRace[]; driverId: string; onAdded: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    race_date: '', circuit_name: '', series_name: '', kart_class: '',
    grid_position: '', finish_position: '', total_starters: '',
    best_lap_ms: '', conditions: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.race_date || !form.circuit_name) return;
    setSaving(true);
    await sb.from('kart_races').insert({
      driver_id:       driverId,
      race_date:       form.race_date,
      circuit_name:    form.circuit_name,
      series_name:     form.series_name || null,
      kart_class:      form.kart_class  || null,
      grid_position:   form.grid_position   ? parseInt(form.grid_position)   : null,
      finish_position: form.finish_position ? parseInt(form.finish_position) : null,
      total_starters:  form.total_starters  ? parseInt(form.total_starters)  : null,
      best_lap_ms:     form.best_lap_ms     ? parseInt(form.best_lap_ms)     : null,
      conditions:      form.conditions || null,
      notes:           form.notes      || null,
    });
    setSaving(false);
    setShowModal(false);
    setForm({ race_date: '', circuit_name: '', series_name: '', kart_class: '',
      grid_position: '', finish_position: '', total_starters: '',
      best_lap_ms: '', conditions: '', notes: '' });
    onAdded();
  };

  const inputStyle: React.CSSProperties = {
    background: T.bg, border: `1px solid ${T.border}`, borderRadius: 4,
    color: '#fff', fontFamily: 'inherit', fontSize: 12, padding: '8px 10px',
    width: '100%', boxSizing: 'border-box',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button
          onClick={() => setShowModal(true)}
          style={{ background: T.gold, border: 'none', borderRadius: 4, color: '#000',
            fontFamily: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', padding: '8px 16px', cursor: 'pointer' }}
        >
          + Add Race
        </button>
      </div>

      <Card>
        {races.length === 0 ? (
          <p style={{ fontSize: 12, color: T.dim, margin: 0 }}>No races recorded yet. Add your first race above.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Date', 'Series', 'Circuit', 'Grid', 'Finish', 'Starters', 'Best Lap', 'Conditions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', color: T.dim, fontSize: 9,
                    letterSpacing: '0.15em', textTransform: 'uppercase', paddingBottom: 8 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {races.map(r => (
                <>
                  <tr
                    key={r.id}
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    style={{ borderTop: `1px solid ${T.dimmer}`, cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px 0', color: T.text }}>{fmtDate(r.race_date)}</td>
                    <td style={{ color: T.dim, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.series_name ?? '—'}</td>
                    <td style={{ color: T.text }}>{r.circuit_name}</td>
                    <td style={{ color: T.text }}>{r.grid_position ? `P${r.grid_position}` : '—'}</td>
                    <td style={{ color: r.finish_position === 1 ? T.gold : T.text, fontWeight: r.finish_position === 1 ? 700 : 400 }}>
                      {r.finish_position ? `P${r.finish_position}` : '—'}
                    </td>
                    <td style={{ color: T.dim }}>{r.total_starters ?? '—'}</td>
                    <td style={{ color: T.text, fontFamily: 'monospace' }}>{r.best_lap_ms ? fmtLap(r.best_lap_ms) : '—'}</td>
                    <td style={{ color: T.dim, fontSize: 11 }}>{r.conditions ?? '—'}</td>
                  </tr>
                  {expanded === r.id && (
                    <tr key={`${r.id}-exp`}>
                      <td colSpan={8} style={{ padding: '10px 12px', background: '#0a0a0a', borderTop: `1px solid ${T.dimmer}` }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11, color: T.text }}>
                          <div><span style={{ color: T.dim }}>Kart class: </span>{r.kart_class ?? '—'}</div>
                          <div><span style={{ color: T.dim }}>Fastest lap: </span>{r.fastest_lap_in_race ? '✓ Yes' : 'No'}</div>
                          <div><span style={{ color: T.dim }}>Gap to winner: </span>{r.gap_to_winner_ms ? `+${(r.gap_to_winner_ms/1000).toFixed(3)}s` : '—'}</div>
                          <div><span style={{ color: T.dim }}>Incidents: </span>{r.incidents ?? 'None'}</div>
                        </div>
                        {r.notes && <div style={{ marginTop: 8, fontSize: 11, color: T.dim }}>{r.notes}</div>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Add Race Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#000a', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#111', border: `1px solid ${T.border}`, borderRadius: 8,
            padding: '28px 32px', width: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Add Race Result</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { key: 'race_date',       label: 'Race Date *', type: 'date' },
                { key: 'circuit_name',    label: 'Circuit *',   type: 'text' },
                { key: 'series_name',     label: 'Series',      type: 'text' },
                { key: 'kart_class',      label: 'Kart Class',  type: 'text' },
                { key: 'grid_position',   label: 'Grid',        type: 'number' },
                { key: 'finish_position', label: 'Finish',      type: 'number' },
                { key: 'total_starters',  label: 'Starters',    type: 'number' },
                { key: 'best_lap_ms',     label: 'Best Lap (ms)', type: 'number' },
                { key: 'conditions',      label: 'Conditions',  type: 'text' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 9, color: T.dim,
                    letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
                  <input
                    type={type}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              ))}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 9, color: T.dim,
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={handleAdd}
                disabled={saving}
                style={{ flex: 1, background: T.gold, border: 'none', borderRadius: 4, color: '#000',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '10px', cursor: 'pointer' }}
              >
                {saving ? 'Saving…' : 'Save Race'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
                  color: T.dim, fontFamily: 'inherit', fontSize: 12, padding: '10px 18px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TAB: Sessions ─────────────────────────────────────────────────────────────
function SessionsTab({
  sessions, driverId, videos, driverName, onAdded, onVideoAdded,
}: {
  sessions: KartSession[];
  driverId: string;
  videos: KartVideo[];
  driverName: string;
  onAdded: () => void;
  onVideoAdded: () => void;
}) {
  const [selected, setSelected] = useState<KartSession | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ session_date: '', circuit_name: '', session_type: 'practice', conditions: '', lap_times_str: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.session_date || !form.circuit_name) return;
    setSaving(true);
    const lap_times = form.lap_times_str
      ? form.lap_times_str.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      : null;
    await sb.from('kart_sessions').insert({
      driver_id: driverId, session_date: form.session_date, circuit_name: form.circuit_name,
      session_type: form.session_type, conditions: form.conditions || null,
      lap_times: lap_times && lap_times.length > 0 ? lap_times : null,
      notes: form.notes || null,
    });
    setSaving(false);
    setShowModal(false);
    setForm({ session_date: '', circuit_name: '', session_type: 'practice', conditions: '', lap_times_str: '', notes: '' });
    onAdded();
  };

  const inputStyle: React.CSSProperties = {
    background: T.bg, border: `1px solid ${T.border}`, borderRadius: 4,
    color: '#fff', fontFamily: 'inherit', fontSize: 12, padding: '8px 10px',
    width: '100%', boxSizing: 'border-box',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button
          onClick={() => setShowModal(true)}
          style={{ background: T.gold, border: 'none', borderRadius: 4, color: '#000',
            fontFamily: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', padding: '8px 16px', cursor: 'pointer' }}
        >
          + Add Session
        </button>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {sessions.length === 0 && (
          <Card><p style={{ fontSize: 12, color: T.dim, margin: 0 }}>No sessions recorded yet.</p></Card>
        )}
        {sessions.map(s => {
          const laps   = s.lap_times ?? [];
          const best   = laps.length ? Math.min(...laps) : null;
          const avg    = laps.length ? laps.reduce((a, b) => a + b, 0) / laps.length : null;
          const isOpen = selected?.id === s.id;
          const chartData = laps.map((ms, i) => ({ lap: i + 1, time: ms }));

          return (
            <Card key={s.id} style={{ cursor: 'pointer' }} >
              <div onClick={() => setSelected(isOpen ? null : s)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 13, color: '#fff' }}>{s.circuit_name}</span>
                  <span style={{ fontSize: 10, color: T.dim, marginLeft: 10 }}>
                    {fmtDate(s.session_date)} · {s.session_type ?? 'session'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 11, color: T.dim }}>
                  <span>{laps.length} laps</span>
                  {best && <span style={{ color: T.gold, fontFamily: 'monospace' }}>{fmtLap(best)}</span>}
                  <span style={{ color: T.dimmer }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {isOpen && (
                <div style={{ marginTop: 14, borderTop: `1px solid ${T.dimmer}`, paddingTop: 14 }}>
                  {laps.length > 0 && (
                    <>
                      <div style={{ display: 'flex', gap: 24, marginBottom: 12, fontSize: 11 }}>
                        <span><span style={{ color: T.dim }}>Best: </span><span style={{ color: T.gold, fontFamily: 'monospace' }}>{best ? fmtLap(best) : '—'}</span></span>
                        <span><span style={{ color: T.dim }}>Avg: </span><span style={{ color: T.text, fontFamily: 'monospace' }}>{avg ? fmtLap(Math.round(avg)) : '—'}</span></span>
                        <span><span style={{ color: T.dim }}>Worst: </span><span style={{ color: T.text, fontFamily: 'monospace' }}>{fmtLap(Math.max(...laps))}</span></span>
                      </div>
                      <ResponsiveContainer width="100%" height={100}>
                        <LineChart data={chartData}>
                          <CartesianGrid stroke={T.dimmer} strokeDasharray="3 3" />
                          <XAxis dataKey="lap" tick={{ fill: T.dim, fontSize: 9 }} />
                          <YAxis
                            domain={['auto', 'auto']}
                            tick={{ fill: T.dim, fontSize: 9 }}
                            tickFormatter={ms => fmtLap(ms)}
                            width={50}
                          />
                          <Tooltip
                            contentStyle={{ background: '#111', border: `1px solid ${T.border}`, fontSize: 10 }}
                            formatter={(v: number) => [fmtLap(v), 'Lap time']}
                          />
                          <Line type="monotone" dataKey="time" stroke={T.gold} strokeWidth={1.5} dot={{ fill: T.gold, r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </>
                  )}

                  {/* Video panel — uploads + AI analysis */}
                  <div style={{ marginTop: 16, borderTop: `1px solid ${T.dimmer}`, paddingTop: 14 }}>
                    {/* Existing videos */}
                    {videos.filter(v => v.kart_session_id === s.id).map(v => (
                      <div key={v.id} style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: '#fff' }}>🎬 {v.title ?? 'Video'}</span>
                          <span style={{
                            fontSize: 9, padding: '2px 6px', borderRadius: 3,
                            background: v.upload_status === 'ready' ? '#22c55e22' : '#44444422',
                            border: `1px solid ${v.upload_status === 'ready' ? '#22c55e44' : '#44444444'}`,
                            color: v.upload_status === 'ready' ? T.green : T.dim,
                          }}>
                            {v.upload_status}
                          </span>
                        </div>
                        {v.upload_status === 'ready' && (
                          <AnalysisPanel
                            videoId={v.id}
                            analysisStatus={v.analysis_status}
                            analysisResult={(v.analysis_result as any) ?? null}
                            driverName={driverName}
                            onAnalysisRequested={onVideoAdded}
                          />
                        )}
                      </div>
                    ))}

                    {/* Upload new video */}
                    <VideoUpload
                      sessionId={s.id}
                      driverId={driverId}
                      onUploaded={onVideoAdded}
                    />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#000a', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#111', border: `1px solid ${T.border}`, borderRadius: 8, padding: '28px 32px', width: 420 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Add Kart Session</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'session_date',   label: 'Date *',   type: 'date' },
                { key: 'circuit_name',   label: 'Circuit *', type: 'text' },
                { key: 'conditions',     label: 'Conditions', type: 'text' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 9, color: T.dim,
                    letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
                  <input type={type} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 9, color: T.dim,
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Session Type</label>
                <select value={form.session_type} onChange={e => setForm(f => ({ ...f, session_type: e.target.value }))}
                  style={{ ...inputStyle }}>
                  {['practice', 'qualifying', 'race', 'test'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, color: T.dim,
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                  Lap Times (ms, comma-separated)
                </label>
                <input type="text" placeholder="e.g. 62450, 61920, 62100"
                  value={form.lap_times_str} onChange={e => setForm(f => ({ ...f, lap_times_str: e.target.value }))}
                  style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={handleAdd} disabled={saving}
                style={{ flex: 1, background: T.gold, border: 'none', borderRadius: 4, color: '#000',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '10px', cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Save Session'}
              </button>
              <button onClick={() => setShowModal(false)}
                style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
                  color: T.dim, fontFamily: 'inherit', fontSize: 12, padding: '10px 18px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TAB: My Kart ──────────────────────────────────────────────────────────────
function KartTab({ hardware, sessions }: { hardware: HardwareItem[]; sessions: KartSession[] }) {
  const karts = hardware.filter(h =>
    h.category?.toLowerCase().includes('kart') || h.item_name?.toLowerCase().includes('kart')
  );

  const bestLap = sessions.flatMap(s => s.lap_times ?? []).length > 0
    ? Math.min(...sessions.flatMap(s => s.lap_times ?? []))
    : null;
  const totalLaps  = sessions.reduce((acc, s) => acc + (s.lap_times?.length ?? 0), 0);

  return (
    <div>
      {karts.length === 0 ? (
        <Card>
          <p style={{ fontSize: 12, color: T.dim, margin: 0 }}>
            No karting equipment in hardware inventory. Add a kart via Portal B → Hardware.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
          {karts.map(k => (
            <Card key={k.id}>
              <div style={{ fontSize: 9, color: T.dim, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
                Kart
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{k.item_name}</div>
              {k.manufacturer && <div style={{ fontSize: 11, color: T.dim }}>{k.manufacturer}{k.model ? ` ${k.model}` : ''}</div>}
              <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11 }}>
                <span><span style={{ color: T.dim }}>Condition: </span><span style={{ color: T.text }}>{k.condition ?? '—'}</span></span>
                {k.purchase_price_aud && (
                  <span><span style={{ color: T.dim }}>Paid: </span><span style={{ color: T.text }}>${k.purchase_price_aud.toLocaleString()}</span></span>
                )}
              </div>
              {k.notes && <div style={{ marginTop: 8, fontSize: 11, color: T.dim }}>{k.notes}</div>}
            </Card>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard label="Total Sessions" value={sessions.length} />
        <StatCard label="Total Laps" value={totalLaps} />
        <StatCard label="Best Lap" value={bestLap ? fmtLap(bestLap) : '—'} />
      </div>
    </div>
  );
}

// ── TAB: Competition Guide ────────────────────────────────────────────────────
const GUIDE_SECTIONS = [
  {
    title: '1. Getting Started',
    icon: '🏁',
    content: [
      'Karting is the most direct pathway to open-wheel racing in Australia.',
      'The Cadet 9 class is designed for drivers aged 7–12. Your kart must comply with Karting Australia technical regulations.',
      'Mandatory safety gear: approved helmet (AS 1698), rib protector, race suit (min. single-layer), gloves, and neck brace recommended.',
      'Cadet karts are sealed 60cc Yamaha KT100 engines — no engine modifications allowed. Focus is entirely on driver skill.',
    ],
  },
  {
    title: '2. Licences',
    icon: '📋',
    content: [
      'A Karting Australia (KA) licence is required to compete at all affiliated meetings.',
      'Cadet Licence: ages 7–12. Requires parent/guardian signature. Annual cost ≈ $90–$120.',
      'Process: complete online application at karting.com.au, attend an approved Safety Awareness Course, obtain medical clearance (GP sign-off).',
      'International CIK licence available for national/international competition — contact KA directly.',
    ],
  },
  {
    title: '3. Finding a Club',
    icon: '🏢',
    content: [
      'Join a KA-affiliated club. NSW has 30+ clubs — nearest to Sydney: Eastern Creek Kart Racing Club, Oran Park Raceway (kart days), Penrith Paceway.',
      'Club membership typically $100–$200/yr and gives access to practise days and club championships.',
      'Most clubs run arrive-and-drive practice days where you can use a hire kart before purchasing your own.',
      'Find your nearest club: karting.com.au/find-a-club',
    ],
  },
  {
    title: '4. First Competition',
    icon: '🎯',
    content: [
      'Register via club secretary or karting.com.au event portal. Pre-entry closes 1–2 weeks before race day.',
      'Scrutineering: kart must pass technical inspection — weight, engine seal, tyres. Arrive 1 hour early.',
      'Race day schedule: registration → scrutineering → practice → qualifying → heats (x2–3) → final.',
      'Cadet classes typically run first. Total on-track time ≈ 30–45 minutes across the day.',
    ],
  },
  {
    title: '5. Series Calendar',
    icon: '📅',
    content: [
      'Karting Australia National Championships — usually September/October, rotates nationally.',
      'NSW State Championship — 4–6 rounds across the year. Points-based, top 3 qualify for Nationals.',
      'Club Championships — monthly rounds, most accessible entry point.',
      'Full calendar: karting.com.au/competition/calendar — check for Cadet 9 rounds specifically.',
    ],
  },
  {
    title: '6. Costs Breakdown (AUD)',
    icon: '💰',
    content: [
      'New Cadet kart (complete): $3,500–$6,000. Used: $1,500–$3,000. Includes chassis, engine, tyres.',
      'Tyres (Vega): ≈$200/set. Budget 1 set per 2 days of racing.',
      'Entry fees: Club day $80–$130. State round $150–$220. National Championship $350–$500.',
      'Travel/accommodation (interstate rounds): $500–$1,500 per event.',
      'Annual budget estimate for active club racer: $8,000–$15,000 depending on frequency.',
    ],
  },
  {
    title: '7. Next Steps — Pathway',
    icon: '🚀',
    content: [
      'Cadet 9 → Cadet 12 (age 12+) → Junior Max (age 12–16) → X30 Junior → Senior classes.',
      'At 15: eligible for F4 Regional scholarship programs (multiple per year in Oceania).',
      'At 16: FIA Super Licence points pathway begins. Formula Ford, F4, open-wheel single-seaters.',
      'Benchmark pace: consistently top-3 in state rounds signals readiness for national campaign.',
      'Goal: win a NSW State Championship round by age 12, challenge for national podium by 14.',
    ],
  },
];

function CompGuideTab() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {GUIDE_SECTIONS.map((sec, i) => (
        <Card key={i} style={{ cursor: 'pointer' }}>
          <div
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
              {sec.icon} {sec.title}
            </div>
            <span style={{ color: T.dim, fontSize: 12 }}>{openIdx === i ? '▲' : '▼'}</span>
          </div>
          {openIdx === i && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${T.dimmer}`, paddingTop: 14 }}>
              {sec.content.map((line, j) => (
                <div key={j} style={{ fontSize: 12, color: T.text, lineHeight: 1.7, marginBottom: 6 }}>
                  • {line}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
type KartTab = 'overview' | 'races' | 'sessions' | 'kart' | 'guide';

const TAB_PATHS: Record<KartTab, string> = {
  overview: '/karting',
  races:    '/karting/races',
  sessions: '/karting/sessions',
  kart:     '/karting/kart',
  guide:    '/karting/competition-guide',
};

export default function KartingDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  // Derive active tab from URL
  const activeTab: KartTab =
    location.pathname === '/karting/races'              ? 'races'    :
    location.pathname === '/karting/sessions'           ? 'sessions' :
    location.pathname === '/karting/kart'               ? 'kart'     :
    location.pathname === '/karting/competition-guide'  ? 'guide'    : 'overview';

  // Data
  const [races,    setRaces]    = useState<KartRace[]>([]);
  const [sessions, setSessions] = useState<KartSession[]>([]);
  const [entries,  setEntries]  = useState<CompEntry[]>([]);
  const [hardware, setHardware] = useState<HardwareItem[]>([]);
  const [videos,   setVideos]   = useState<KartVideo[]>([]);
  const [drivers,  setDrivers]  = useState<DriverProfile[]>([]);
  const [selectedDriverAuthId, setSelectedDriverAuthId] = useState<string>('');

  // Determine which driver_id to filter by
  const driverId: string = user?.id ?? DEV_DRIVER_ID;
  const filterById       = role === 'coach' && selectedDriverAuthId
    ? selectedDriverAuthId : driverId;

  // Driver display name for AI analysis prompt
  const driverName = drivers.find(d => d.auth_user_id === filterById)?.display_name
    ?? (role === 'enzo' ? (user?.email?.split('@')[0] ?? 'Enzo') : 'Enzo');

  const load = async () => {
    const [racesRes, sessRes, entryRes, hwRes, videosRes] = await Promise.all([
      sb.from('kart_races').select('*').eq('driver_id', filterById).order('race_date', { ascending: false }),
      sb.from('kart_sessions').select('*').eq('driver_id', filterById).order('session_date', { ascending: false }),
      sb.from('kart_competition_entries').select('*').eq('driver_id', filterById).order('event_date'),
      sb.from('hardware_inventory').select('*'),
      sb.from('kart_videos').select('*').eq('driver_id', filterById).order('created_at', { ascending: false }),
    ]);
    setRaces(racesRes.data    ?? []);
    setSessions(sessRes.data  ?? []);
    setEntries(entryRes.data  ?? []);
    setHardware(hwRes.data    ?? []);
    setVideos(videosRes.data  ?? []);
  };

  useEffect(() => {
    load();
    // Load driver list for coach selector
    if (role === 'coach') {
      sb.from('driver_profile').select('id, auth_user_id, display_name, full_name').then(({ data }) => {
        if (data) {
          setDrivers(data);
          if (!selectedDriverAuthId && data.length > 0) {
            setSelectedDriverAuthId(data.find(d => d.display_name === 'Enzo')?.auth_user_id ?? data[0].auth_user_id);
          }
        }
      });
    }
  }, [role, selectedDriverAuthId]);

  useEffect(() => { load(); }, [filterById]);

  const navTabs: { id: KartTab; label: string }[] = [
    { id: 'overview', label: '📊 Overview'         },
    { id: 'races',    label: '🏆 Races'             },
    { id: 'sessions', label: '⏱️ Sessions'           },
    { id: 'kart',     label: '🏎️ My Kart'           },
    { id: 'guide',    label: '📖 Competition Guide' },
  ];

  return (
    <DashboardShell>
      <div style={{ background: T.bg, minHeight: 'calc(100vh - 41px)', padding: '18px 22px',
        fontFamily: "'DM Mono', monospace" }}>

        {/* Header */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, color: T.dimmer, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
              Module 13
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Go-Karting</h1>
          </div>

          {/* Coach: driver selector */}
          {role === 'coach' && drivers.length > 0 && (
            <select
              value={selectedDriverAuthId}
              onChange={e => setSelectedDriverAuthId(e.target.value)}
              style={{ background: '#111', border: `1px solid ${T.border}`, color: '#fff',
                fontFamily: 'inherit', fontSize: 12, padding: '6px 10px', borderRadius: 4, cursor: 'pointer' }}
            >
              {drivers.map(d => (
                <option key={d.id} value={d.auth_user_id}>{d.display_name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 18, overflowX: 'auto' }}>
          {navTabs.map(t => (
            <button
              key={t.id}
              onClick={() => navigate(TAB_PATHS[t.id])}
              style={{
                background: activeTab === t.id ? '#1a1a1a' : 'none',
                border: `1px solid ${activeTab === t.id ? T.gold : T.dimmer}`,
                color: activeTab === t.id ? T.gold : T.dim,
                fontFamily: 'inherit', fontSize: 10, letterSpacing: '0.1em',
                padding: '6px 14px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview'  && <OverviewTab  races={races} entries={entries} />}
        {activeTab === 'races'     && <RacesTab     races={races} driverId={filterById} onAdded={load} />}
        {activeTab === 'sessions'  && <SessionsTab  sessions={sessions} driverId={filterById} videos={videos} driverName={driverName} onAdded={load} onVideoAdded={load} />}
        {activeTab === 'kart'      && <KartTab      hardware={hardware} sessions={sessions} />}
        {activeTab === 'guide'     && <CompGuideTab />}
      </div>
    </DashboardShell>
  );
}
