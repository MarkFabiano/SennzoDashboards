// src/components/VideoUpload.tsx
// Project Sennzo — Module 13: Mux video upload component.
//
// Flow:
//   1. User selects a video file
//   2. POST to TIS /api/karting/video/upload-url → { upload_url, video_id }
//   3. PUT file directly to Mux upload URL (via XMLHttpRequest for progress)
//   4. onUploaded(videoId) called on success
//
// Props:
//   sessionId  — kart_sessions.id to attach the video to
//   driverId   — auth.users.id of the driver
//   onUploaded — callback with the new kart_videos.id

import { useRef, useState } from 'react';

interface Props {
  sessionId: string;
  driverId:  string;
  onUploaded: (videoId: string) => void;
}

const T = {
  bg:     '#0d0d0d',
  card:   '#0f0f0f',
  border: '#1e1e1e',
  gold:   '#E8B84B',
  dim:    '#444',
  text:   '#ccc',
  green:  '#22c55e',
  red:    '#ef4444',
};

const TIS_URL = import.meta.env.VITE_TIS_API_URL ?? 'http://localhost:3001';

type Stage = 'idle' | 'requesting' | 'uploading' | 'done' | 'error';

export function VideoUpload({ sessionId, driverId, onUploaded }: Props) {
  const [stage,    setStage]    = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [errMsg,   setErrMsg]   = useState('');
  const fileInputRef            = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrMsg('');
    setStage('requesting');
    setProgress(0);

    try {
      // 1. Get Mux upload URL from TIS
      const uploadRes = await fetch(`${TIS_URL}/api/karting/video/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id:      driverId,
          kart_session_id: sessionId,
          title:           file.name,
          footage_type:    'onboard',
        }),
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ error: uploadRes.statusText }));
        throw new Error((err as any).error ?? 'Failed to get upload URL');
      }

      const { upload_url, video_id } = (await uploadRes.json()) as { upload_url: string; video_id: string };

      // 2. PUT file to Mux via XHR (for progress tracking)
      setStage('uploading');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', upload_url, true);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed with status ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(file);
      });

      setStage('done');
      setProgress(100);
      onUploaded(video_id);

    } catch (err: any) {
      console.error('[VideoUpload]', err.message);
      setErrMsg(err.message ?? 'Upload failed');
      setStage('error');
    }
  };

  const reset = () => {
    setStage('idle');
    setProgress(0);
    setErrMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 9, color: T.dim, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
        Upload Video
      </div>

      {stage === 'idle' && (
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#111', border: `1px dashed ${T.border}`, borderRadius: 6,
          padding: '10px 18px', cursor: 'pointer', color: T.dim, fontSize: 12,
        }}>
          <span>🎬</span> Choose video file…
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </label>
      )}

      {stage === 'requesting' && (
        <div style={{ fontSize: 11, color: T.dim }}>Preparing upload…</div>
      )}

      {stage === 'uploading' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.dim, marginBottom: 4 }}>
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div style={{ background: T.border, borderRadius: 3, height: 4, overflow: 'hidden' }}>
            <div style={{
              background: T.gold, height: '100%', borderRadius: 3,
              width: `${progress}%`, transition: 'width 0.2s',
            }} />
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
          <span style={{ color: T.green }}>✓ Upload complete — processing</span>
          <button onClick={reset} style={{
            background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
            color: T.dim, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', padding: '2px 8px',
          }}>Upload another</button>
        </div>
      )}

      {stage === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
          <span style={{ color: T.red }}>✗ {errMsg}</span>
          <button onClick={reset} style={{
            background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
            color: T.dim, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', padding: '2px 8px',
          }}>Try again</button>
        </div>
      )}
    </div>
  );
}
