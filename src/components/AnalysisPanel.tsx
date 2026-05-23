// src/components/AnalysisPanel.tsx
// Project Sennzo — Module 13: Claude kart video analysis panel.
//
// Shows the structured AI analysis of a kart video session.
// Handles all analysis_status values: not_started, queued, in_progress, complete, failed.
//
// Props:
//   videoId        — kart_videos.id
//   analysisStatus — current analysis_status from DB
//   analysisResult — parsed JSON from kart_videos.analysis_result (null if not complete)
//   driverName     — shown in the analysis request call
//   onAnalysisRequested — called after analysis request is fired (so parent can poll)

interface CategoryResult {
  rating:       number;
  observations: string[];
  improvements: string[];
}

interface AnalysisResult {
  summary:               string;
  braking:               CategoryResult;
  racing_line:           CategoryResult;
  throttle_application:  CategoryResult;
  kart_control:          CategoryResult;
  strengths:             string[];
  priority_focus:        string;
  coach_note:            string;
}

interface Props {
  videoId:              string;
  analysisStatus:       string;
  analysisResult:       AnalysisResult | null;
  driverName?:          string;
  onAnalysisRequested:  () => void;
}

const T = {
  bg:     '#0d0d0d',
  card:   '#0f0f0f',
  border: '#1e1e1e',
  gold:   '#E8B84B',
  dim:    '#444',
  dimmer: '#2a2a2a',
  text:   '#ccc',
  green:  '#22c55e',
  red:    '#ef4444',
  blue:   '#3b82f6',
};

const TIS_URL = import.meta.env.VITE_TIS_API_URL ?? 'http://localhost:3001';

const CATEGORY_LABELS: Record<string, string> = {
  braking:              'Braking',
  racing_line:          'Racing Line',
  throttle_application: 'Throttle',
  kart_control:         'Kart Control',
};

// ── Star rating ───────────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= rating ? T.gold : T.dimmer, fontSize: 14 }}>★</span>
      ))}
    </span>
  );
}

// ── Category card ─────────────────────────────────────────────────────────────
function CategoryCard({ label, data }: { label: string; data: CategoryResult }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 6,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </div>
        <Stars rating={data.rating} />
      </div>
      {data.observations.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: T.dim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            Observations
          </div>
          {data.observations.map((obs, i) => (
            <div key={i} style={{ fontSize: 11, color: T.text, marginBottom: 3, paddingLeft: 8, borderLeft: `2px solid ${T.dimmer}` }}>
              {obs}
            </div>
          ))}
        </div>
      )}
      {data.improvements.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: T.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            To Improve
          </div>
          {data.improvements.map((imp, i) => (
            <div key={i} style={{ fontSize: 11, color: T.text, marginBottom: 3, paddingLeft: 8, borderLeft: `2px solid ${T.gold}44` }}>
              {imp}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function AnalysisPanel({
  videoId,
  analysisStatus,
  analysisResult,
  driverName,
  onAnalysisRequested,
}: Props) {
  const requestAnalysis = async () => {
    try {
      const res = await fetch(`${TIS_URL}/api/claude/kart-video-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, driver_name: driverName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[AnalysisPanel] Request error:', (err as any).error);
      }
    } catch (e: any) {
      console.error('[AnalysisPanel] Fetch error:', e.message);
    } finally {
      onAnalysisRequested();
    }
  };

  // ── Not started / failed ───────────────────────────────────────────────────
  if (analysisStatus === 'not_started' || analysisStatus === 'failed') {
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {analysisStatus === 'failed' && (
            <span style={{ fontSize: 11, color: T.red }}>Analysis failed — </span>
          )}
          <button
            onClick={requestAnalysis}
            style={{
              background: '#3b82f615', border: `1px solid #3b82f6`,
              borderRadius: 4, padding: '6px 16px', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 11, color: T.blue,
              letterSpacing: '0.08em',
            }}
          >
            🤖 {analysisStatus === 'failed' ? 'Retry Analysis' : 'Run AI Analysis'}
          </button>
        </div>
      </div>
    );
  }

  // ── In progress / queued ───────────────────────────────────────────────────
  if (analysisStatus === 'in_progress' || analysisStatus === 'queued') {
    return (
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: T.dim }}>
        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
        <span>AI analysis in progress…</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Complete — render full analysis ────────────────────────────────────────
  if (analysisStatus === 'complete' && analysisResult) {
    const categories: Array<[string, CategoryResult]> = [
      ['braking',              analysisResult.braking],
      ['racing_line',          analysisResult.racing_line],
      ['throttle_application', analysisResult.throttle_application],
      ['kart_control',         analysisResult.kart_control],
    ];

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 9, color: T.dim, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
          AI Analysis — Reggie
        </div>

        {/* Summary */}
        <div style={{
          background: '#111', border: `1px solid ${T.border}`, borderRadius: 6,
          padding: '12px 14px', marginBottom: 14, fontSize: 12, color: T.text, lineHeight: 1.6,
        }}>
          {analysisResult.summary}
        </div>

        {/* 4 category cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
          {categories.map(([key, data]) => (
            <CategoryCard key={key} label={CATEGORY_LABELS[key] ?? key} data={data} />
          ))}
        </div>

        {/* Strengths */}
        {analysisResult.strengths.length > 0 && (
          <div style={{
            background: '#0d1a0d', border: `1px solid #22c55e33`, borderRadius: 6,
            padding: '12px 14px', marginBottom: 10,
          }}>
            <div style={{ fontSize: 9, color: T.green, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
              Strengths
            </div>
            {analysisResult.strengths.map((s, i) => (
              <div key={i} style={{ fontSize: 11, color: T.text, marginBottom: 4, paddingLeft: 8, borderLeft: `2px solid ${T.green}` }}>
                {s}
              </div>
            ))}
          </div>
        )}

        {/* Priority focus */}
        <div style={{
          background: '#1a1500', border: `1px solid ${T.gold}44`, borderRadius: 6,
          padding: '12px 14px', marginBottom: 10,
        }}>
          <div style={{ fontSize: 9, color: T.gold, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            Priority Focus
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
            {analysisResult.priority_focus}
          </div>
        </div>

        {/* Coach note */}
        <div style={{
          background: '#0d0d1a', border: `1px solid ${T.blue}44`, borderRadius: 6,
          padding: '12px 14px',
        }}>
          <div style={{ fontSize: 9, color: T.blue, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            Coach Note
          </div>
          <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5, fontStyle: 'italic' }}>
            "{analysisResult.coach_note}"
          </div>
        </div>
      </div>
    );
  }

  return null;
}
