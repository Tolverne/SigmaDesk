// src/components/canvas/CanvasPlayback.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { CanvasStroke, PlaybackState } from '../../types/canvas.types';

// Old Start
// interface CanvasPlaybackProps {
//   strokes: CanvasStroke[];
//   width?: number;
//   height?: number;
//   className?: string;
// }
// Old End

// New Start
import { getMergedStrokesForSessions } from '../../services/canvasService';

type CanvasPlaybackProps =
  | {
      /** Pre-supplied stroke stream (legacy mode) */
      strokes: CanvasStroke[];
      sessionIds?: never;
      width?: number;
      height?: number;
      className?: string;
      autoplay?: boolean;
      speed?: number;
      /** Render a static final image (no controls/timeline; uses HTML canvas) */
      snapshot?: boolean;
    }
  | {
      /** Merge these sessionIds on the fly */
      sessionIds: string[];
      strokes?: never;
      width?: number;
      height?: number;
      className?: string;
      autoplay?: boolean;
      speed?: number;
      /** Render a static final image (no controls/timeline; uses HTML canvas) */
      snapshot?: boolean;
    };
// New End

function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const CanvasPlayback: React.FC<CanvasPlaybackProps> = ({
  // Old Start
  // strokes,
  // width = 800,
  // height = 400,
  // className = '',
  // Old End

  // New Start
  strokes,
  sessionIds,
  width = 800,
  height = 400,
  className = '',
  autoplay = false,
  speed = 1,
  snapshot = false,
  // New End
}) => {
  // New Start: single source of truth for stroke list
  const [dataStrokes, setDataStrokes] = useState<CanvasStroke[]>(strokes ?? []);
  const [loading, setLoading] = useState<boolean>(!!sessionIds && sessionIds.length > 0);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  // New End

  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    totalDuration: 0,
    playbackSpeed: speed || 1,
    visibleStrokes: [],
  });

  // FIX: initialize refs with null and allow null in the type
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // New Start: snapshot canvas ref (used only when snapshot === true)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // New End

  // New Start: load/merge strokes when sessionIds provided; else use prop strokes
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (sessionIds && sessionIds.length) {
        try {
          setLoading(true);
          setLoadErr(null);
          const merged = await getMergedStrokesForSessions(sessionIds);
          if (cancelled) return;

          // Ensure sorted (service should already do this, but be safe)
          const ordered = [...(merged ?? [])].sort((a, b) => {
            const ta =
              (a as any).timestamp_ms ??
              (a as any).stroke_order ??
              new Date((a as any).created_at ?? 0).getTime();
            const tb =
              (b as any).timestamp_ms ??
              (b as any).stroke_order ??
              new Date((b as any).created_at ?? 0).getTime();
            return ta - tb;
          });

          setDataStrokes(ordered);
        } catch (e: any) {
          if (!cancelled) {
            setLoadErr(e?.message || 'Failed to load merged strokes');
            setDataStrokes([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else if (strokes) {
        setDataStrokes(strokes);
        setLoading(false);
        setLoadErr(null);
      } else {
        setDataStrokes([]);
        setLoading(false);
        setLoadErr(null);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionIds, strokes]);
  // New End

  // Set total duration when strokes change
  useEffect(() => {
    // Old Start
    // if (strokes.length === 0) {
    //   setPlaybackState((p) => ({ ...p, totalDuration: 0, currentTime: 0, visibleStrokes: [] }));
    //   return;
    // }
    // const totalDuration = Math.max(...strokes.map((s) => s.timestamp_ms));
    // setPlaybackState((p) => ({ ...p, totalDuration, currentTime: 0, visibleStrokes: [] }));
    // Old End

    // New Start
    if (dataStrokes.length === 0) {
      setPlaybackState((p) => ({
        ...p,
        totalDuration: 0,
        currentTime: 0,
        visibleStrokes: [],
        isPlaying: false,
      }));
      return;
    }
    let totalDuration = Math.max(...dataStrokes.map((s) => s.timestamp_ms || 0));
    // Fallback if timestamps are missing or degenerate
    if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
      totalDuration = Math.max(0, (dataStrokes.length - 1) * 40); // ~25fps spacing
    }
    setPlaybackState((p) => ({
      ...p,
      totalDuration,
      currentTime: 0,
      visibleStrokes: snapshot ? dataStrokes : [], // in snapshot mode we render all at once
      isPlaying: snapshot ? false : !!autoplay,
      playbackSpeed: speed || p.playbackSpeed || 1,
    }));
    // New End
  }, [dataStrokes, autoplay, speed, snapshot]);

  // Keep speed in sync if prop changes (non-snapshot mode)
  useEffect(() => {
    setPlaybackState((p) => ({ ...p, playbackSpeed: speed || p.playbackSpeed || 1 }));
  }, [speed]);

  // ===== Playback (non-snapshot) timing loop =====
  const tick = useCallback(
    (t: number) => {
      if (snapshot) return; // No animation in snapshot mode

      // FIX: handle null baseline explicitly
      const baseline = lastTimeRef.current === null ? t : lastTimeRef.current;
      const delta = (t - baseline) * (playbackState.playbackSpeed || 1);
      lastTimeRef.current = t;

      setPlaybackState((p) => {
        const nextTime = Math.min(p.currentTime + delta, p.totalDuration);
        const visible = dataStrokes.filter((s) => (s.timestamp_ms || 0) <= nextTime);
        const stillPlaying = nextTime < p.totalDuration;
        return {
          ...p,
          currentTime: nextTime,
          visibleStrokes: visible,
          isPlaying: stillPlaying,
        };
      });

      if (playbackState.isPlaying) {
        animationRef.current = requestAnimationFrame(tick);
      }
    },
    [playbackState.isPlaying, playbackState.playbackSpeed, dataStrokes, snapshot]
  );

  useEffect(() => {
    if (snapshot) {
      // No animation loop in snapshot mode
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    if (playbackState.isPlaying) {
      // FIX: set to null, not undefined
      lastTimeRef.current = null;
      animationRef.current = requestAnimationFrame(tick);
      return () => {
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      };
    }
  }, [playbackState.isPlaying, tick, snapshot]);

  const play = () => setPlaybackState((p) => ({ ...p, isPlaying: true }));
  const pause = () => setPlaybackState((p) => ({ ...p, isPlaying: false }));
  const reset = () =>
    setPlaybackState((p) => ({
      ...p,
      isPlaying: false,
      currentTime: 0,
      visibleStrokes: snapshot ? dataStrokes : [],
    }));
  const skipBack = () =>
    setPlaybackState((p) => ({ ...p, currentTime: Math.max(0, p.currentTime - 2000) }));
  const skipForward = () =>
    setPlaybackState((p) => ({
      ...p,
      currentTime: Math.min(p.totalDuration, p.currentTime + 2000),
    }));

  // ===== Snapshot renderer (HTML canvas) =====
  // Many systems store strokes as raw points rather than SVG path strings.
  // We therefore replay strokes onto a <canvas> so erasing works (destination-out).
  useEffect(() => {
    if (!snapshot) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = (window && window.devicePixelRatio) || 1;
    // Resize for HiDPI
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale to CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const toNumber = (v: any) =>
      typeof v === 'number' ? v : Number(v ?? 0);

    const drawPath2D = (sd: any, s: CanvasStroke) => {
      if (!sd?.d || typeof Path2D === 'undefined') return false;
      try {
        const path = new Path2D(sd.d);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = (s as any).stroke_width ?? 2;
        ctx.strokeStyle = (s as any).stroke_color ?? '#000';
        const isEraser = String((s as any).tool_type || '').toLowerCase().includes('eras');
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.stroke(path);
        return true;
      } catch {
        return false;
      }
    };

    const drawFromPoints = (sd: any, s: CanvasStroke) => {
      // Accept sd.points | sd.pts | s.points; each item could be {x,y} or [x,y]
      const pts =
        (sd && (sd.points || sd.pts)) ||
        (s as any).points ||
        null;
      if (!Array.isArray(pts) || pts.length === 0) return false;

      const getXY = (pt: any) => {
        if (Array.isArray(pt)) return { x: toNumber(pt[0]), y: toNumber(pt[1]) };
        return { x: toNumber(pt?.x), y: toNumber(pt?.y) };
      };

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = (s as any).stroke_width ?? 2;
      ctx.strokeStyle = (s as any).stroke_color ?? '#000';
      const isEraser = String((s as any).tool_type || '').toLowerCase().includes('eras');
      ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';

      ctx.beginPath();
      const first = getXY(pts[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) {
        const p = getXY(pts[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      return true;
    };

    // Replay all strokes in order
    for (const s of dataStrokes) {
      const sd = (s as any).stroke_data ?? {};
      // Prefer Path2D if available; otherwise draw via points
      if (!drawPath2D(sd, s)) {
        drawFromPoints(sd, s);
      }
    }
  }, [snapshot, dataStrokes, width, height]);
  // ===== End snapshot renderer =====

  // New Start: basic loading/error UX for sessionIds mode
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow ${className}`}>
        <div className="p-4 text-sm text-gray-500">Loading board…</div>
      </div>
    );
  }
  if (loadErr) {
    return (
      <div className={`bg-white rounded-lg shadow ${className}`}>
        <div className="p-4 text-sm text-red-600">Failed to load playback: {loadErr}</div>
      </div>
    );
  }
  // New End

  // New Start: decide what to render (controls hidden in snapshot mode)
  const showControls = !snapshot;
  const strokesToRender = snapshot ? dataStrokes : playbackState.visibleStrokes;
  // New End

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Controls */}
      {/* Old Start: controls always visible */}
      {/* <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-t-lg"> ... </div> */}
      {/* Old End */}
      {/* New Start: hide controls in snapshot mode */}
      {showControls && (
        <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-t-lg">
          <div className="flex items-center space-x-2">
            {!playbackState.isPlaying ? (
              <button
                onClick={play}
                className="px-3 py-2 rounded-md bg-sigma-blue text-white flex items-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Play</span>
              </button>
            ) : (
              <button
                onClick={pause}
                className="px-3 py-2 rounded-md bg-gray-700 text-white flex items-center space-x-2"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            )}

            <button
              onClick={reset}
              className="px-3 py-2 rounded-md bg-white text-gray-700 border flex items-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>

            <button
              onClick={skipBack}
              className="px-3 py-2 rounded-md bg-white text-gray-700 border flex items-center space-x-2"
            >
              <SkipBack className="w-4 h-4" />
              <span>-2s</span>
            </button>

            <button
              onClick={skipForward}
              className="px-3 py-2 rounded-md bg-white text-gray-700 border flex items-center space-x-2"
            >
              <SkipForward className="w-4 h-4" />
              <span>+2s</span>
            </button>
          </div>

          <div className="text-xs text-gray-600">
            {formatTime(playbackState.currentTime)} / {formatTime(playbackState.totalDuration)}
          </div>
        </div>
      )}
      {/* New End */}

      {/* Drawing surface */}
      <div className="p-3">
        <div className="border rounded-lg overflow-hidden bg-gray-50">
          {/* Old Start: SVG-only renderer (fails for erasing and point-based strokes) */}
          {/* <svg width={width} height={height} className="bg-white"> ... </svg> */}
          {/* Old End */}

          {/* New Start: snapshot uses HTML canvas; playback uses SVG */}
          {snapshot ? (
            <canvas ref={canvasRef} width={width} height={height} className="block bg-white" />
          ) : (
            <svg width={width} height={height} className="bg-white">
              {strokesToRender.map((s) => (
                <path
                  key={s.id}
                  d={(s as any)?.stroke_data?.d || '' /* If empty, nothing is drawn (OK) */}
                  fill="none"
                  stroke={
                    String((s as any).tool_type || '').toLowerCase().includes('eras')
                      ? '#FFFFFF'
                      : (s as any).stroke_color
                  }
                  strokeWidth={(s as any).stroke_width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    // Note: CSS mix-blend-mode doesn't support 'destination-out' in SVG;
                    // playback mode won't truly erase. Snapshot mode (canvas) handles erasing correctly.
                    mixBlendMode: String((s as any).tool_type || '').toLowerCase().includes('eras')
                      ? ('destination-out' as any)
                      : 'normal',
                  }}
                />
              ))}
            </svg>
          )}
          {/* New End */}
        </div>

        {/* Stats */}
        <div className="mt-4 pt-2 border-t border-gray-200 text-sm text-gray-600 flex justify-center space-x-6">
          {/* Old Start */}
          {/* <span>Strokes: {strokes.length}</span> */}
          {/* Old End */}
          {/* New Start */}
          <span>Strokes: {dataStrokes.length}</span>
          {/* New End */}
          <span>Visible: {snapshot ? dataStrokes.length : playbackState.visibleStrokes.length}</span>
          <span>Duration: {formatTime(playbackState.totalDuration)}</span>
          {sessionIds && <span>Merged from {sessionIds.length} sessions</span>}
          {snapshot && <span>Snapshot</span>}
        </div>
      </div>
    </div>
  );
};

export default CanvasPlayback;
