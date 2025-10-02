// src/components/canvas/CanvasPlayback.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import type { CanvasStroke } from '../../types/canvas.types';

// Old Start
// import { CanvasStroke, PlaybackState } from '../../types/canvas.types';
// Old End

import { getMergedStrokesForSessions } from '../../services/canvasService';

// New Start: order-based playback props (ignore timestamps)
// Accept either preloaded strokes or a list of sessionIds to fetch/merge.
// Adds live stepsPerSecond control + optional initialFull image.
type CanvasPlaybackProps =
  | {
      strokes: CanvasStroke[];
      sessionIds?: never;
      width?: number;
      height?: number;
      className?: string;
      stepsPerSecond?: number;        // default 40
      initialFull?: boolean;          // default true
    }
  | {
      sessionIds: string[];
      strokes?: never;
      width?: number;
      height?: number;
      className?: string;
      stepsPerSecond?: number;        // default 40
      initialFull?: boolean;          // default true
    };
// New End

function byStrokeOrder(a: CanvasStroke, b: CanvasStroke) {
  const ao = (a as any).stroke_order ?? Number.MAX_SAFE_INTEGER;
  const bo = (b as any).stroke_order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  const ac = (a as any).created_at ? Date.parse((a as any).created_at) : 0;
  const bc = (b as any).created_at ? Date.parse((b as any).created_at) : 0;
  return ac - bc;
}

const CanvasPlayback: React.FC<CanvasPlaybackProps> = ({
  strokes,
  sessionIds,
  width = 800,
  height = 400,
  className = '',
  stepsPerSecond = 40,
  initialFull = true,
}) => {
  // Load strokes (pre-supplied or merged from sessionIds)
  const [dataStrokes, setDataStrokes] = useState<CanvasStroke[]>(strokes ?? []);
  const [loading, setLoading] = useState<boolean>(!!sessionIds && sessionIds.length > 0);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Order-mode state
  const total = dataStrokes.length;
  const [visibleCount, setVisibleCount] = useState<number>(initialFull ? total : 0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [sps, setSps] = useState<number>(Math.max(1, Math.floor(stepsPerSecond))); // steps per second

  // Drawing + animation refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // Load/merge strokes or accept preloaded
  useEffect(() => {
    let cancelled = false;
    const go = async () => {
      if (sessionIds && sessionIds.length) {
        try {
          setLoading(true); setLoadErr(null);
          const merged = await getMergedStrokesForSessions(sessionIds);
          if (cancelled) return;
          setDataStrokes((merged ?? []).slice().sort(byStrokeOrder));
        } catch (e: any) {
          if (!cancelled) { setLoadErr(e?.message || 'Failed to load strokes'); setDataStrokes([]); }
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else if (strokes) {
        setDataStrokes(strokes.slice().sort(byStrokeOrder));
        setLoading(false); setLoadErr(null);
      } else {
        setDataStrokes([]); setLoading(false); setLoadErr(null);
      }
    };
    go();
    return () => { cancelled = true; };
  }, [sessionIds, strokes]);

  // Reset visibleCount when data changes or initialFull changes
  useEffect(() => {
    setVisibleCount(initialFull ? total : 0);
    setIsPlaying(false);
  }, [total, initialFull]);

  // ----- Draw first N strokes on <canvas> (order-based) -----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = (window && window.devicePixelRatio) || 1;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const toNumber = (v: any) => (typeof v === 'number' ? v : Number(v ?? 0));

    const drawPath2D = (sd: any, s: any) => {
      if (!sd?.d || typeof Path2D === 'undefined') return false;
      try {
        const path = new Path2D(sd.d);
        const isEraser = String(s.tool_type || '').toLowerCase().includes('eras');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = s.stroke_width ?? 2;
        ctx.strokeStyle = s.stroke_color ?? '#000';
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.stroke(path);
        return true;
      } catch { return false; }
    };

    const drawFromPoints = (sd: any, s: any) => {
      const pts = (sd && (sd.points || sd.pts)) || (s as any).points;
      if (!Array.isArray(pts) || pts.length === 0) return false;

      const getXY = (pt: any) => Array.isArray(pt)
        ? { x: toNumber(pt[0]), y: toNumber(pt[1]) }
        : { x: toNumber(pt?.x), y: toNumber(pt?.y) };

      const isEraser = String(s.tool_type || '').toLowerCase().includes('eras');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = s.stroke_width ?? 2;
      ctx.strokeStyle = s.stroke_color ?? '#000';
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

    const N = Math.max(0, Math.min(total, Math.floor(visibleCount)));
    for (let i = 0; i < N; i++) {
      const s: any = dataStrokes[i];
      const sd = s?.stroke_data ?? {};
      if (!drawPath2D(sd, s)) drawFromPoints(sd, s);
    }
  }, [dataStrokes, visibleCount, width, height, total]);

  // ----- Animation loop (order-based; ignore timestamps) -----
  const stepsPerMs = Math.max(0.0001, sps / 1000);

  const tick = useCallback((ts: number) => {
    const last = lastTsRef.current;
    lastTsRef.current = ts;
    if (last == null) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const deltaMs = ts - last;
    const inc = deltaMs * stepsPerMs; // fractional steps
    setVisibleCount(prev => {
      const next = Math.min(total, prev + inc);
      if (next >= total) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTsRef.current = null;
        setIsPlaying(false);
      }
      return next;
    });
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [isPlaying, stepsPerMs, total]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [isPlaying, tick]);

  // ----- Controls -----
  const play = () => { if (visibleCount >= total) setVisibleCount(0); setIsPlaying(true); };
  const pause = () => setIsPlaying(false);
  const reset = () => { setIsPlaying(false); setVisibleCount(0); };
  const showFull = () => { setIsPlaying(false); setVisibleCount(total); };
  const step = (delta: number) =>
    setVisibleCount(c => Math.max(0, Math.min(total, Math.round(c + delta))));

  // ----- Loading/Errors -----
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
        <div className="p-4 text-sm text-red-600">Failed to load strokes: {loadErr}</div>
      </div>
    );
  }

  const sliderValue = Math.round(Math.min(total, Math.max(0, visibleCount)));

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Controls */}
      <div className="p-3 border-b bg-gray-50">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            {!isPlaying ? (
              <button
                onClick={play}
                className="px-3 py-2 rounded-md bg-sigma-blue text-white flex items-center gap-2"
              >
                <Play className="w-4 h-4" /><span>Play</span>
              </button>
            ) : (
              <button
                onClick={pause}
                className="px-3 py-2 rounded-md bg-gray-700 text-white flex items-center gap-2"
              >
                <Pause className="w-4 h-4" /><span>Pause</span>
              </button>
            )}
            <button
              onClick={() => step(-5)}
              className="px-2 py-2 rounded-md bg-white text-gray-700 border flex items-center"
              title="Step back 5"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => step(+5)}
              className="px-2 py-2 rounded-md bg-white text-gray-700 border flex items-center"
              title="Step forward 5"
            >
              <SkipForward className="w-4 h-4" />
            </button>
            <button
              onClick={reset}
              className="px-3 py-2 rounded-md bg-white text-gray-700 border flex items-center gap-2"
              title="Reset to start"
            >
              <RotateCcw className="w-4 h-4" /><span>Reset</span>
            </button>
            <button
              onClick={showFull}
              className="px-3 py-2 rounded-md bg-white text-gray-700 border"
              title="Show full image"
            >
              Full
            </button>
          </div>

          {/* Slider */}
          <div className="flex-1 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={Math.max(0, total)}
              value={sliderValue}
              onChange={(e) => setVisibleCount(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-600 tabular-nums">
              Step {sliderValue} / {total}
            </div>
          </div>

          {/* Speed control */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Speed</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={sps}
              onChange={(e) => setSps(Math.max(1, Number(e.target.value)))}
            >
              <option value={20}>20 sps</option>
              <option value={30}>30 sps</option>
              <option value={40}>40 sps</option>
              <option value={60}>60 sps</option>
              <option value={90}>90 sps</option>
            </select>
            <input
              type="number"
              min={1}
              step={1}
              value={sps}
              onChange={(e) => setSps(Math.max(1, Number(e.target.value)))}
              className="w-20 border rounded px-2 py-1 text-sm"
              title="Custom steps/sec"
            />
          </div>
        </div>
      </div>

      {/* Drawing surface */}
      <div className="p-3">
        <div className="border rounded-lg overflow-hidden bg-gray-50">
          <canvas ref={canvasRef} width={width} height={height} className="block bg-white" />
        </div>
        <div className="mt-2 text-xs text-gray-500 flex gap-4 justify-center">
          <span>Strokes: {total}</span>
          {sessionIds && <span>Merged from {sessionIds.length} sessions</span>}
          <span>Speed: {sps} sps</span>
        </div>
      </div>
    </div>
  );
};

export default CanvasPlayback;
