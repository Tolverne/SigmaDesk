/* eslint-disable no-console */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { CanvasSession, CanvasStroke, CanvasType, CanvasState, Point, SVGPath } from '../../types/canvas.types';
import { STUDENT_COLORS, STROKE_WIDTHS } from '../../types/canvas.types';
import { canvasService, offlineCanvasService } from '../../services/canvasService';
import CanvasToolbar from './CanvasToolbar';
// New Start: playback
import CanvasPlayback from './CanvasPlayback';
// New End

type BaseProps = {
  className?: string;
  isReadOnly?: boolean;
};

type BySessionId = BaseProps & {
  sessionId: string;
};

type ByLessonSlot = BaseProps & {
  lessonId: string;
  slotIndex: number;
  /** defaults to 'student' */
  canvasType?: CanvasType;
};

export type CanvasWorkspaceProps = BySessionId | ByLessonSlot;

function isBySessionId(p: CanvasWorkspaceProps): p is BySessionId {
  return (p as BySessionId).sessionId !== undefined;
}

const DEFAULT_STATE: CanvasState = {
  currentTool: 'pen',
  currentColor: STUDENT_COLORS[0],
  currentWidth: STROKE_WIDTHS[2],
  isDrawing: false,
  startTime: 0,
  strokes: [],
  undoStack: [],
};

const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = (props) => {
  const { user } = useAuth();
  const readOnly = props.isReadOnly === true;

  const [session, setSession] = useState<CanvasSession | null>(null);
  const [strokes, setStrokes] = useState<CanvasStroke[]>([]);
  const [state, setState] = useState<CanvasState>(DEFAULT_STATE);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingPointsRef = useRef<Point[]>([]);
  const nextOrderRef = useRef<number>(1);

  // New Start: local playback toggle + sizing that matches drawing surface
  const [showPlayback, setShowPlayback] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [surfaceSize, setSurfaceSize] = useState<{ width: number; height: number }>({ width: 800, height: 400 });
  // New End

  // Session fetch — split by prop shape with precise deps
  useEffect(() => {
    let cancelled = false;

    const loadBySessionId = async (id: string) => {
      try {
        setLoadingSession(true);
        console.log('[CanvasWorkspace] get by sessionId →', id);
        const s = await canvasService.getCanvasSessionById(id);
        if (!cancelled) setSession(s);
      } catch (err) {
        console.error('[CanvasWorkspace] failed to get session by id', err);
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    };

    const loadByLessonSlot = async (lessonId: string, uid: string | undefined, slotIndex: number, canvasType?: CanvasType) => {
      if (!uid) {
        console.warn('[CanvasWorkspace] no user; cannot create personal session. Waiting for Auth…');
        setLoadingSession(false);
        return;
      }
      try {
        setLoadingSession(true);
        console.log('[CanvasWorkspace] getOrCreate by lesson slot →', { lessonId, uid, slotIndex, canvasType: canvasType ?? 'student' });
        const s = await canvasService.getOrCreateSession(lessonId, uid, slotIndex, canvasType ?? 'student');
        if (!cancelled) setSession(s);
      } catch (err) {
        console.error('[CanvasWorkspace] failed to get/create session', err);
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    };

    if (isBySessionId(props)) {
      // depend ONLY on sessionId
      loadBySessionId(props.sessionId);
    } else {
      // depend ONLY on lessonId, slotIndex, user.id, canvasType
      loadByLessonSlot(props.lessonId, user?.id, props.slotIndex, props.canvasType);
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // precise deps
    (isBySessionId(props) ? props.sessionId : props.lessonId),
    (isBySessionId(props) ? undefined : props.slotIndex),
    (isBySessionId(props) ? undefined : props.canvasType),
    (isBySessionId(props) ? undefined : user?.id),
  ]);

  // Load strokes for the session (with offline fallback)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session) return;

      try {
        console.log('[CanvasWorkspace] fetching strokes for session', session.id);
        const list = await canvasService.getSessionStrokes(session.id);
        if (!cancelled) {
          setStrokes(list);
          nextOrderRef.current = (list[list.length - 1]?.stroke_order ?? 0) + 1;
        }
      } catch (err) {
        console.warn('[CanvasWorkspace] online strokes failed; trying offline…', err);
        try {
          const offline = await offlineCanvasService.getOfflineStrokes(session.id);
          if (!cancelled && offline?.length) {
            setStrokes(offline as CanvasStroke[]);
            nextOrderRef.current = (offline[offline.length - 1]?.stroke_order ?? 0) + 1;
          }
        } catch (e) {
          console.error('[CanvasWorkspace] offline strokes fetch failed', e);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [session?.id]);

  // Online/offline indicator
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Canvas setup / resize
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const s of strokes) {
      const pts = s.stroke_data?.points ?? [];
      if (!pts.length) continue;

      const isEraser = s.tool_type === 'eraser';
      ctx.save();
      ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
      ctx.strokeStyle = s.stroke_color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const w = p.pressure ? Math.max(1, p.pressure * s.stroke_width) : s.stroke_width;
        ctx.lineWidth = w;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      if (pts.length === 1) {
        const p = pts[0];
        const w = p.pressure ? Math.max(1, p.pressure * s.stroke_width) : s.stroke_width;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, w / 2), 0, Math.PI * 2);
        if (isEraser) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = 'rgba(0,0,0,1)';
        } else {
          ctx.fillStyle = s.stroke_color;
        }
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
  }, [strokes]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const holder = containerRef.current; // New
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    // Use the container width and the fixed height (400) to size both live canvas and playback
    const rect = canvas.getBoundingClientRect();
    const widthCss = rect.width || (holder ? holder.clientWidth : 800);
    const heightCss = rect.height || 400;

    canvas.width = Math.max(1, Math.floor(widthCss * dpr));
    canvas.height = Math.max(1, Math.floor(heightCss * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // New Start: store CSS size for playback
    setSurfaceSize({ width: Math.round(widthCss), height: Math.round(heightCss) });
    // New End

    redraw();
  }, [redraw]);

  useEffect(() => {
    resize();
  }, [resize, strokes.length]);

  // Toolbar handlers
  const handleToolChange = (tool: 'pen' | 'eraser') => setState((s) => ({ ...s, currentTool: tool }));
  const handleColorChange = (color: string) => setState((s) => ({ ...s, currentColor: color }));
  const handleWidthChange = (width: number) => setState((s) => ({ ...s, currentWidth: width }));

  const pushStroke = async (points: Point[]) => {
    if (!session || points.length === 0) return;

    const stroke: Omit<CanvasStroke, 'id' | 'created_at'> = {
      session_id: session.id,
      stroke_data: { d: '', points } as SVGPath,
      stroke_color: state.currentColor,
      stroke_width: state.currentWidth,
      tool_type: state.currentTool,
      timestamp_ms: Date.now(),
      stroke_order: nextOrderRef.current++,
    };

    // optimistic UI
    const optimistic: CanvasStroke = {
      ...(stroke as any),
      id: `local_${stroke.stroke_order}_${stroke.timestamp_ms}`,
      created_at: new Date().toISOString(),
    };

    console.log('[CanvasWorkspace] pushStroke → optimistic add', {
      session: session.id, order: stroke.stroke_order, pts: points.length, tool: state.currentTool,
    });

    setStrokes((prev) => [...prev, optimistic]);

    try {
      if (isOnline) {
        const saved = await canvasService.saveStroke(stroke);
        console.log('[CanvasWorkspace] pushStroke → server ack');
        setStrokes((prev) => prev.map((s) => (s.id === optimistic.id ? saved : s)));
      } else {
        console.log('[CanvasWorkspace] offline → staging stroke');
        await offlineCanvasService.saveStrokeOffline({ ...(optimistic as any), needs_sync: true });
      }
    } catch (err) {
      console.error('[CanvasWorkspace] pushStroke failed, rolling back', err);
      setStrokes((prev) => prev.filter((s) => s.id !== optimistic.id));
    }
  };

  // Pointer handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    if (!session) {
      console.warn('[CanvasWorkspace] pointerDown ignored; no session yet');
      return;
    }
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    drawingPointsRef.current = [
      { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure ?? 1, timestamp: Date.now() },
    ];
    setState((s) => ({ ...s, isDrawing: true, startTime: Date.now() }));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (readOnly || !state.isDrawing) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    drawingPointsRef.current.push({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure ?? 1,
      timestamp: Date.now(),
    });
    // quick incremental draw for responsiveness
    const ctx = ctxRef.current;
    if (ctx) {
      const pts = drawingPointsRef.current;
      if (pts.length >= 2) {
        const a = pts[pts.length - 2];
        const b = pts[pts.length - 1];
        ctx.save();
        ctx.globalCompositeOperation = state.currentTool === 'eraser' ? 'destination-out' : 'source-over';
        const w = b.pressure ? Math.max(1, b.pressure * state.currentWidth) : state.currentWidth;
        ctx.lineWidth = w;
        ctx.strokeStyle = state.currentColor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  const onPointerUp = async () => {
    if (readOnly || !state.isDrawing) return;
    const points = drawingPointsRef.current.slice();
    drawingPointsRef.current = [];
    setState((s) => ({ ...s, isDrawing: false }));
    await pushStroke(points);
  };

  // Undo & clear
  const handleUndo = async () => {
    if (readOnly) return;
    const last = strokes[strokes.length - 1];
    if (!last) return;
    setStrokes((prev) => prev.slice(0, -1));
    try {
      if (last.id && !String(last.id).startsWith('local_')) {
        await canvasService.deleteStroke(last.id);
      }
    } catch (e) {
      console.error('Undo delete failed', e);
    }
  };

  const handleClear = async () => {
    if (readOnly || !session) return;
    const prev = strokes;
    setStrokes([]);
    try {
      await canvasService.clearCanvas(session.id);
    } catch (e) {
      console.error('Clear server failed, restoring local strokes', e);
      setStrokes(prev);
    }
  };

  const canUndo = strokes.length > 0;

  return (
    <div className={props.className}>
      <CanvasToolbar
        canvasState={state}
        onToolChange={handleToolChange}
        onColorChange={handleColorChange}
        onWidthChange={handleWidthChange}
        onUndo={handleUndo}
        onClear={handleClear}
        canUndo={canUndo}
        isOnline={isOnline}
      />

      <div className="border border-gray-200 rounded-b-lg overflow-hidden bg-white">
        <div
          // Old Start: no ref for container sizing
          // className="relative" style={{ height: 400 }}
          // Old End
          // New Start: keep same layout but capture ref for playback sizing
          ref={containerRef}
          className="relative"
          style={{ height: 400 }}
          // New End
        >
          {loadingSession && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 z-10">
              Preparing Canvas…
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="w-full h-full block touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
      </div>

      {/* New Start: Playback toggle + player (order-based; has speed control) */}
      <div className="mt-3">
        <button
          onClick={() => setShowPlayback(v => !v)}
          className="px-3 py-2 rounded-md border bg-white text-gray-700"
        >
          {showPlayback ? 'Hide' : 'Show'} Playback
        </button>

        {showPlayback && session?.id && (
          <div className="mt-3">
            <CanvasPlayback
              sessionIds={[session.id]}
              width={surfaceSize.width}
              height={surfaceSize.height}
              initialFull
              // stepsPerSecond control is built into CanvasPlayback UI
            />
          </div>
        )}
      </div>
      {/* New End */}
    </div>
  );
};

export default CanvasWorkspace;
