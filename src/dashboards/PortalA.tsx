// src/dashboards/PortalA.tsx
// Project Sennzo — Portal A: Driver Cockpit
//
// Enzo's (and regular-tier drivers') view. Clean, motivating, zero secrets.
// Shows: stats / lap history / track records / milestone progress / session start
//
// NO behavioral data, NO coaching notes, NO SECRET fields of any kind.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { createClient } from '@supabase/supabase-js';
import { DashboardShell } from '../components/DashboardShell';

// ── Supabase client ─────────────────────────────────────────────────────────
const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL     ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
);

// ── Lap time formatter ────────────────────────────────────────────────────────
function formatLapTime(ms: number): string {
  const mins   = Math.floor(ms / 60000);
  const secs   = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${mins}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'laps' | 'tracks' | 'progress' | 'session-start';

interface Lap {
  lap_id:       string;
  session_id:   string;
  track_name:   string;
  lap_number:   number;
  lap_time_ms:  number;
  sector_1_ms?: number;
  sector_2_ms?: number;
  sector_3_ms?: number;
  is_valid:     boolean;
  is_personal_best: boolean;
  created_at:   string;
}
interface Track {
  track_id:       string;
  track_name:     string;
  pb_lap_time_ms?: number;
  total_laps?:    number;
  benchmark_lap_ms?: number;
  coaching_notes?: string;
}
interface Milestone {
  id:             string;
  year:           number;
  phase:          string;
  milestone_name: string;
  status:         string;
  completion_date?: string;
}

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg: '#0d0d0d', card: '#0f0f0f', border: '#1e1e1e',
  gold: '#E8B84B', dim: '#444', dimmer: '#2a2a2a', text: '#ccc',
};
const labelSty = { fontSize: 9, color: T.dim, letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8 };

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: '14px 16px', ...style }}>
      {children}
    </div>
  );
}

// ── Computed helpers ──────────────────────────────────────────────────────────
function computeStats(laps: Lap[]) {
  const validLaps = laps.filter(l => l.is_valid);
  const sessions  = new Set(laps.map(l => l.session_id)).size;

  const trackCounts: Record<string, number> = {};
  const trackPBs:    Record<string, number> = {};
  for (const lap of validLaps) {
    trackCounts[lap.track_name] = (trackCounts[lap.track_name] ?? 0) + 1;
    if (!trackPBs[lap.track_name] || lap.lap_time_ms < trackPBs[lap.track_name]) {
      trackPBs[lap.track_name] = lap.lap_time_ms;
    }
  }

  const favouriteTrack = Object.entries(trackCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  const globalPB       = validLaps.length ? Math.min(...validLaps.map(l => l.lap_time_ms)) : null;

  return { totalLaps: laps.length, sessions, favouriteTrack, globalPB, trackPBs, trackCounts };
}

function buildPBTrendChart(laps: Lap[]): { name: string; [track: string]: number | string }[] {
  // Group valid laps by date (proxy for session) and track
  const byDate: Record<string, Record<string, number>> = {};
  for (const lap of laps.filter(l => l.is_valid)) {
    const date = lap.created_at.slice(0, 10);
    if (!byDate[date]) byDate[date] = {};
    const key = lap.track_name;
    if (!byDate[date][key] || lap.lap_time_ms < byDate[date][key]) {
      byDate[date][key] = lap.lap_time_ms;
    }
  }
  return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, tracks]) => ({
    name: date.slice(5), // MM-DD
    ...Object.fromEntries(Object.entries(tracks).map(([t, ms]) => [t, parseFloat((ms / 1000).toFixed(3))]))
  }));
}

// ── Track colours for chart lines ─────────────────────────────────────────────
const TRACK_COLORS = ['#E8B84B', '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#06b6d4'];

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Overview
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({
  laps, sessions, driverName, nextMilestone,
}: { laps: Lap[]; sessions: number; driverName: string; nextMilestone: Milestone | null }) {
  const stats    = computeStats(laps);
  const recent3  = laps.filter(l => l.is_valid).slice(0, 3);
  const chartData = buildPBTrendChart(laps);
  const trackNames = Array.from(new Set(laps.filter(l => l.is_valid).map(l => l.track_name)));

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>Hey {driverName} 🏁</div>
        <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>Ready to find more time?</div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Laps',       value: stats.totalLaps || '—' },
          { label: 'Sessions',         value: sessions || '—' },
          { label: 'Favourite Track',  value: stats.favouriteTrack },
          { label: 'Personal Best',    value: stats.globalPB ? formatLapTime(stats.globalPB) : '—' },
        ].map(({ label, value }) => (
          <Card key={label}>
            <div style={{ fontSize: 9, color: T.dim, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Recent sessions */}
        <Card>
          <div style={labelSty}>Recent Sessions</div>
          {recent3.length === 0 ? (
            <div style={{ fontSize: 11, color: T.dimmer }}>No sessions yet — jump in!</div>
          ) : recent3.map((lap, i) => (
            <div key={lap.lap_id} style={{
              marginBottom: i < recent3.length - 1 ? 10 : 0,
              paddingBottom: i < recent3.length - 1 ? 10 : 0,
              borderBottom: i < recent3.length - 1 ? `1px solid ${T.border}` : 'none',
            }}>
              <div style={{ fontSize: 12, color: '#fff' }}>{lap.track_name}</div>
              <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>
                {lap.created_at.slice(0, 10)} · {formatLapTime(lap.lap_time_ms)}
              </div>
            </div>
          ))}
        </Card>

        {/* Next milestone */}
        <Card>
          <div style={labelSty}>Next Milestone</div>
          {nextMilestone ? (
            <>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', animation: 'cockpit-pulse 2s ease infinite' }} />
                <span style={{ fontSize: 9, color: '#3b82f6', letterSpacing: '0.1em' }}>IN PROGRESS</span>
              </div>
              <div style={{ fontSize: 14, color: '#fff', lineHeight: 1.4 }}>{nextMilestone.milestone_name}</div>
              <div style={{ fontSize: 10, color: T.dim, marginTop: 6 }}>Year {nextMilestone.year} — {nextMilestone.phase}</div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: T.dimmer }}>All Year 1 milestones in progress — keep going!</div>
          )}
        </Card>
      </div>

      {/* PB Trend Chart */}
      {chartData.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={labelSty}>PB Trend (lower = faster)</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#151515" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: T.dim, fontSize: 9 }} />
              <YAxis tick={{ fill: T.dim, fontSize: 9 }} tickFormatter={v => `${v}s`} />
              <Tooltip
                formatter={(v: number) => `${v}s`}
                contentStyle={{ background: '#111', border: `1px solid ${T.border}`, fontSize: 11, fontFamily: 'inherit' }}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: T.dim }} />
              {trackNames.map((track, i) => (
                <Line
                  key={track}
                  type="monotone"
                  dataKey={track}
                  stroke={TRACK_COLORS[i % TRACK_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: TRACK_COLORS[i % TRACK_COLORS.length] }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Laps
// ─────────────────────────────────────────────────────────────────────────────
function LapsTab({ laps }: { laps: Lap[] }) {
  const [filterTrack, setFilterTrack]   = useState('All');
  const [sortBy, setSortBy]             = useState<'date' | 'time' | 'track'>('date');
  const [sortAsc, setSortAsc]           = useState(false);

  const tracks = ['All', ...Array.from(new Set(laps.map(l => l.track_name)))];

  let filtered = filterTrack === 'All' ? laps : laps.filter(l => l.track_name === filterTrack);
  filtered = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortBy === 'date') diff = a.created_at.localeCompare(b.created_at);
    if (sortBy === 'time') diff = a.lap_time_ms - b.lap_time_ms;
    if (sortBy === 'track') diff = a.track_name.localeCompare(b.track_name);
    return sortAsc ? diff : -diff;
  });

  const toggle = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(p => !p);
    else { setSortBy(col); setSortAsc(true); }
  };

  const hdr = (label: string, col: typeof sortBy) => (
    <th onClick={() => toggle(col)} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, color: sortBy === col ? T.gold : T.dim, letterSpacing: '0.1em', fontWeight: 400, cursor: 'pointer', userSelect: 'none' }}>
      {label} {sortBy === col ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <div style={labelSty}>Lap History ({filtered.length})</div>
        <select
          value={filterTrack}
          onChange={e => setFilterTrack(e.target.value)}
          style={{ background: '#111', border: `1px solid ${T.border}`, borderRadius: 4, padding: '4px 10px', color: T.text, fontFamily: 'inherit', fontSize: 11, marginLeft: 'auto' }}
        >
          {tracks.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${T.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#111', borderBottom: `1px solid ${T.border}` }}>
              {hdr('Date', 'date')}
              {hdr('Track', 'track')}
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, color: T.dim, letterSpacing: '0.1em', fontWeight: 400 }}>Lap #</th>
              {hdr('Time', 'time')}
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, color: T.dim, letterSpacing: '0.1em', fontWeight: 400 }}>S1</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, color: T.dim, letterSpacing: '0.1em', fontWeight: 400 }}>S2</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, color: T.dim, letterSpacing: '0.1em', fontWeight: 400 }}>S3</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, color: T.dim, letterSpacing: '0.1em', fontWeight: 400 }}>PB</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((lap, i) => (
              <tr
                key={lap.lap_id}
                style={{
                  background: lap.is_personal_best ? '#1a1500' : i % 2 === 0 ? T.card : '#111',
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <td style={{ padding: '8px 10px', color: T.dim }}>{lap.created_at.slice(0, 10)}</td>
                <td style={{ padding: '8px 10px', color: T.text }}>{lap.track_name}</td>
                <td style={{ padding: '8px 10px', color: T.dim }}>{lap.lap_number}</td>
                <td style={{ padding: '8px 10px', color: lap.is_personal_best ? T.gold : '#fff', fontWeight: lap.is_personal_best ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>
                  {formatLapTime(lap.lap_time_ms)}
                </td>
                <td style={{ padding: '8px 10px', color: T.dimmer, fontVariantNumeric: 'tabular-nums' }}>{lap.sector_1_ms ? formatLapTime(lap.sector_1_ms) : '—'}</td>
                <td style={{ padding: '8px 10px', color: T.dimmer, fontVariantNumeric: 'tabular-nums' }}>{lap.sector_2_ms ? formatLapTime(lap.sector_2_ms) : '—'}</td>
                <td style={{ padding: '8px 10px', color: T.dimmer, fontVariantNumeric: 'tabular-nums' }}>{lap.sector_3_ms ? formatLapTime(lap.sector_3_ms) : '—'}</td>
                <td style={{ padding: '8px 10px' }}>
                  {lap.is_personal_best && <span style={{ fontSize: 9, color: T.gold, background: '#E8B84B22', border: `1px solid ${T.gold}44`, borderRadius: 3, padding: '2px 6px' }}>PB</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Tracks
// ─────────────────────────────────────────────────────────────────────────────
function TracksTab({ laps, tracks }: { laps: Lap[]; tracks: Track[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  // Per-track stats from laps
  const trackStats: Record<string, { pb: number; laps: number; sessions: Set<string> }> = {};
  for (const lap of laps.filter(l => l.is_valid)) {
    if (!trackStats[lap.track_name]) trackStats[lap.track_name] = { pb: Infinity, laps: 0, sessions: new Set() };
    const ts = trackStats[lap.track_name];
    ts.laps++;
    ts.sessions.add(lap.session_id);
    if (lap.lap_time_ms < ts.pb) ts.pb = lap.lap_time_ms;
  }

  const trackMap: Record<string, Track> = {};
  for (const t of tracks) trackMap[t.track_name] = t;

  const driven = Object.keys(trackStats).sort((a, b) => {
    const lapsA = laps.filter(l => l.track_name === a);
    const lapsB = laps.filter(l => l.track_name === b);
    const la = lapsA.length ? lapsA[lapsA.length - 1].created_at : '';
    const lb = lapsB.length ? lapsB[lapsB.length - 1].created_at : '';
    return lb.localeCompare(la); // most recently driven first
  });

  const selTrack    = selected ? trackStats[selected] : null;
  const selTrackInfo = selected ? trackMap[selected] : null;
  const selLaps     = selected ? laps.filter(l => l.track_name === selected && l.is_valid).sort((a, b) => a.created_at.localeCompare(b.created_at)) : [];
  const selChartData = selLaps.map((l, i) => ({
    name: `L${i + 1}`,
    time: parseFloat((l.lap_time_ms / 1000).toFixed(3)),
  }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 12 }}>
      {/* Track cards */}
      <div>
        <div style={labelSty}>Track Records ({driven.length})</div>
        {driven.length === 0 ? (
          <Card><span style={{ fontSize: 11, color: T.dimmer }}>No laps recorded yet</span></Card>
        ) : driven.map(track => {
          const ts   = trackStats[track];
          const info = trackMap[track];
          const gap  = info?.benchmark_lap_ms && ts.pb !== Infinity
            ? ((ts.pb - info.benchmark_lap_ms) / info.benchmark_lap_ms * 100).toFixed(1)
            : null;
          return (
            <div
              key={track}
              onClick={() => setSelected(selected === track ? null : track)}
              style={{
                background: selected === track ? '#131300' : T.card,
                border: `1px solid ${selected === track ? T.gold + '44' : T.border}`,
                borderRadius: 6, padding: '12px 16px', marginBottom: 8, cursor: 'pointer',
              }}
              onMouseEnter={e => { if (selected !== track) e.currentTarget.style.borderColor = '#333'; }}
              onMouseLeave={e => { if (selected !== track) e.currentTarget.style.borderColor = T.border; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{track}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.gold, fontVariantNumeric: 'tabular-nums' }}>
                  {ts.pb !== Infinity ? formatLapTime(ts.pb) : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <span style={{ fontSize: 10, color: T.dim }}>{ts.laps} laps</span>
                <span style={{ fontSize: 10, color: T.dim }}>{ts.sessions.size} sessions</span>
                {gap && <span style={{ fontSize: 10, color: parseFloat(gap) < 5 ? '#22c55e' : parseFloat(gap) < 15 ? '#eab308' : '#f97316' }}>+{gap}% vs AI99</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Track detail */}
      {selected && selTrack && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={labelSty}>{selected} — Detail</div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: T.dimmer, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>✕</button>
          </div>

          <Card style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: T.dim, marginBottom: 6 }}>Personal Best</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: T.gold }}>
              {selTrack.pb !== Infinity ? formatLapTime(selTrack.pb) : '—'}
            </div>
            {selTrackInfo?.benchmark_lap_ms && selTrack.pb !== Infinity && (
              <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>
                AI99 reference: {formatLapTime(selTrackInfo.benchmark_lap_ms)}
                {' '}· Gap: +{((selTrack.pb - selTrackInfo.benchmark_lap_ms) / selTrackInfo.benchmark_lap_ms * 100).toFixed(1)}%
              </div>
            )}
          </Card>

          {selChartData.length > 1 && (
            <Card style={{ marginBottom: 10 }}>
              <div style={labelSty}>Lap History</div>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={selChartData} margin={{ top: 4, right: 8, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#151515" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: T.dim, fontSize: 8 }} />
                  <YAxis tick={{ fill: T.dim, fontSize: 8 }} tickFormatter={v => `${v}s`} />
                  <Tooltip formatter={(v: number) => `${v}s`} contentStyle={{ background: '#111', border: `1px solid ${T.border}`, fontSize: 11, fontFamily: 'inherit' }} />
                  <Line type="monotone" dataKey="time" stroke={T.gold} strokeWidth={2} dot={{ r: 2, fill: T.gold }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {selTrackInfo?.coaching_notes && (
            <Card>
              <div style={labelSty}>Track Notes</div>
              <div style={{ fontSize: 11, color: T.text, lineHeight: 1.6 }}>{selTrackInfo.coaching_notes}</div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Progress / Milestones
// ─────────────────────────────────────────────────────────────────────────────
function ProgressTab({ milestones }: { milestones: Milestone[] }) {
  const years = [1, 2, 3];
  const STATUS_ICON: Record<string, string> = {
    'Completed':   '✅',
    'Active':      '🔵',
    'Not Started': '⭕',
    'Skipped':     '⬜',
  };
  const STATUS_COLOR: Record<string, string> = {
    'Completed':   '#22c55e',
    'Active':      '#3b82f6',
    'Not Started': T.dimmer,
    'Skipped':     T.dimmer,
  };

  return (
    <div>
      <div style={labelSty}>Training Roadmap — Your Journey</div>
      <div style={{ fontSize: 11, color: T.dim, marginBottom: 16 }}>
        {milestones.filter(m => m.status === 'Completed').length} of {milestones.length} milestones complete
      </div>
      {years.map(y => {
        const yMs = milestones.filter(m => m.year === y);
        const done = yMs.filter(m => m.status === 'Completed').length;
        return (
          <div key={y} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Year {y}</div>
              <div style={{ flex: 1, height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: T.gold, width: `${yMs.length ? (done / yMs.length) * 100 : 0}%`, transition: 'width 0.4s' }} />
              </div>
              <div style={{ fontSize: 10, color: T.dim }}>{done}/{yMs.length}</div>
            </div>
            {yMs.map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                background: m.status === 'Completed' ? '#0a1a0a' : T.card,
                border: `1px solid ${m.status === 'Completed' ? '#22c55e33' : T.border}`,
                borderRadius: 6, padding: '10px 14px', marginBottom: 6,
                opacity: m.status === 'Skipped' ? 0.5 : 1,
              }}>
                <span style={{ fontSize: 14, marginTop: 1 }}>{STATUS_ICON[m.status] ?? '⭕'}</span>
                <div>
                  <div style={{ fontSize: 12, color: STATUS_COLOR[m.status] ?? '#ccc' }}>{m.milestone_name}</div>
                  <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>{m.phase}</div>
                  {/* NO target_date shown to Enzo — only completion_date */}
                  {m.status === 'Completed' && m.completion_date && (
                    <div style={{ fontSize: 10, color: '#22c55e', marginTop: 3 }}>
                      ✓ Completed {m.completion_date}
                    </div>
                  )}
                </div>
                {m.status === 'Active' && (
                  <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', animation: 'cockpit-pulse 2s ease infinite', flexShrink: 0, marginTop: 3 }} />
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Session Start
// ─────────────────────────────────────────────────────────────────────────────
function SessionStartTab({ driverName }: { driverName: string }) {
  const [started, setStarted] = useState(false);

  return (
    <div style={{ maxWidth: 500 }}>
      <Card style={{ marginBottom: 12 }}>
        <div style={labelSty}>Today's Focus</div>
        <div style={{ fontSize: 16, color: '#fff', lineHeight: 1.5 }}>
          Brake modulation — trail braking into high-speed corners
        </div>
        <div style={{ fontSize: 10, color: T.dim, marginTop: 6 }}>
          Focus on Copse and Maggotts — carry more speed through apex
        </div>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={labelSty}>Last Session Recap</div>
        <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>
          Good improvement at T1. Trail braking showed real progress. Keep building on that apex confidence.
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <div style={labelSty}>Reggie Says</div>
        <div style={{ fontSize: 13, color: T.gold, lineHeight: 1.6, fontStyle: 'italic' }}>
          "Every lap is a chance to be better than the last one. You've got this, {driverName}. Let's find that time."
        </div>
      </Card>

      {!started ? (
        <button
          onClick={() => setStarted(true)}
          style={{
            width: '100%', background: T.gold, border: 'none', borderRadius: 6,
            padding: '14px', fontSize: 14, fontWeight: 700, color: '#000',
            cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em',
          }}
        >
          Start Session →
        </button>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: 22, marginBottom: 10 }}>🏁</div>
          <div style={{ fontSize: 14, color: '#22c55e', fontWeight: 700 }}>Session initialising...</div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 6 }}>
            TIS connecting · Reggie standing by
          </div>
          <div style={{ fontSize: 10, color: T.dimmer, marginTop: 16 }}>
            Launch F1 25 → start driving → Portal C will go live automatically
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab nav ───────────────────────────────────────────────────────────────────
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview',      label: 'Overview'      },
  { id: 'laps',          label: 'Laps'          },
  { id: 'tracks',        label: 'Tracks'        },
  { id: 'progress',      label: 'Progress'      },
  { id: 'session-start', label: 'Session Start' },
];

// ── CSS ───────────────────────────────────────────────────────────────────────
const COCKPIT_CSS = `
  @keyframes cockpit-pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 4px #3b82f6; }
    50% { opacity: 0.4; box-shadow: none; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Main Portal A
// ─────────────────────────────────────────────────────────────────────────────
export default function PortalA() {
  const navigate     = useNavigate();
  const [tab,        setTab]        = useState<Tab>('overview');
  const [laps,       setLaps]       = useState<Lap[]>([]);
  const [tracks,     setTracks]     = useState<Track[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [driverName, setDriverName] = useState('Enzo');
  const [loading,    setLoading]    = useState(true);

  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);

    // Load driver name from profile if available
    sb.from('driver_profile').select('full_name').limit(1).single()
      .then(({ data }) => { if (data?.full_name) setDriverName(data.full_name.split(' ')[0]); });

    Promise.all([
      sb.from('laps').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('tracks').select('*').order('track_name'),
      sb.from('training_roadmap').select('id, year, phase, milestone_name, status, completion_date').order('year').order('phase'),
    ]).then(([lapRes, trackRes, msRes]) => {
      setLaps(lapRes.data as Lap[] ?? []);
      setTracks(trackRes.data as Track[] ?? []);
      setMilestones(msRes.data as Milestone[] ?? []);
      setLoading(false);
    });
  }, []);

  const stats         = computeStats(laps);
  const sessionCount  = new Set(laps.map(l => l.session_id)).size;
  const nextMilestone = milestones.find(m => m.status === 'Active')
    ?? milestones.find(m => m.status === 'Not Started')
    ?? null;

  return (
    <DashboardShell>
      <style>{COCKPIT_CSS}</style>
      <div style={{ background: T.bg, minHeight: 'calc(100vh - 41px)', padding: '18px 22px', fontFamily: "'DM Mono', monospace" }}>

        {/* Header */}
        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 9, color: T.dimmer, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 3 }}>Project Sennzo</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.gold, letterSpacing: '0.05em' }}>Driver Cockpit</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {loading && <span style={{ fontSize: 10, color: T.dimmer }}>Loading...</span>}
            <button
              onClick={() => navigate('/karting')}
              title="Go-Karting Module"
              style={{
                background: '#E8B84B15', border: '1px solid #E8B84B44',
                borderRadius: 4, padding: '5px 12px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 10, color: T.gold,
                letterSpacing: '0.1em',
              }}
            >
              🏎 Go-Karting
            </button>
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${T.border}`, marginBottom: 16 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'none', border: 'none',
                borderBottom: tab === t.id ? `2px solid ${T.gold}` : '2px solid transparent',
                padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 11, color: tab === t.id ? T.gold : T.dim, marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          <OverviewTab laps={laps} sessions={sessionCount} driverName={driverName} nextMilestone={nextMilestone} />
        )}
        {tab === 'laps'     && <LapsTab laps={laps} />}
        {tab === 'tracks'   && <TracksTab laps={laps} tracks={tracks} />}
        {tab === 'progress' && <ProgressTab milestones={milestones} />}
        {tab === 'session-start' && <SessionStartTab driverName={driverName} />}
      </div>
    </DashboardShell>
  );
}
