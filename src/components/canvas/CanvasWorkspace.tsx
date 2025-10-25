/* eslint-disable no-console */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type {
  CanvasSession,
  CanvasStroke,
  CanvasType,
  CanvasState,
  Point,
  SVGPath,
} from '../../types/canvas.types';
import { STUDENT_COLORS, STROKE_WIDTHS } from '../../types/canvas.types';
import { canvasService, offlineCanvasService } from '../../services/canvasService';
import CanvasToolbar from './CanvasToolbar';
import { getEffectiveLock } from '../../services/feedbackService';
import { analyticsService } from '../../services/analyticsService'; // ⬅️ NEW

type LockContext = {
  classId: string;
  lessonId: string;
  slotIndex: number;
  /** The student whose canvas this is (typically the session owner). */
  studentId: string;
};

type AnalyticsContext = {
  /** The active viewer's id (student usually). */
  userId: string;
  classId: string;
  courseId: string;
  lessonId: string;
  slotIndex: number;
  /** Optional; if omitted we’ll use the live session id when available. */
  sessionId?: string;
};

type BaseProps = {
  className?: string;
  /** Force read-only regardless of locks/role. */
  isReadOnly?: boolean;
  /** When provided, workspace will poll and enforce teacher locks. */
  lockContext?: LockContext;
  /** Optional lock polling interval (ms). Default: 20000. */
  lockPollMs?: number;
  /** Optional analytics context for focus/heartbeat/stroke events. */
  analyticsContext?: AnalyticsContext; // ⬅️ NEW
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

  // --- Session + strokes state ------------------------------------------------
  const [session, setSession] = useState<CanvasSession | null>(null);
  const [strokes, setStrokes] = useState<CanvasStroke[]>([]);
  const [state, setState] = useState<CanvasState>(DEFAULT_STATE);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [loadingSession, setLoadingSession] = useState<boolean>(true);

  // --- Lock (effective) state -------------------------------------------------
  const [effectiveLock, setEffectiveLock] = useState<null | { locked: boolean; lock_until: string | null }>(null);

  // read-only is forced by either external prop or an active lock
  const forcedReadOnly = props.isReadOnly === true || !!effectiveLock?.locked;

  // --- Canvas refs ------------------------------------------------------------
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingPointsRef = useRef<Point[]>([]);
  const nextOrderRef = useRef<number>(1);

  // Helper to build analytics ctx (when available)
  const getAnalyticsCtx = useCallback((): (AnalyticsContext & { sessionId: string }) | null => {
    if (!props.analyticsContext) return null;
    // Prefer live session id when ready; else fall back to provided one
    const sid =
      (isBySessionId(props) ? props.sessionId : undefined) ||
      session?.id ||
      props.analyticsContext.sessionId;
    if (!sid) return null;
    return { ...props.analyticsContext, sessionId: sid };
  }, [props, session?.id]);

  // --- Session fetch ----------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const loadBySessionId = async (id: string) => {
      try {
        setLoadingSession(true);
        const s = await canvasService.getCanvasSessionById(id);
        if (!cancelled) setSession(s);
      } catch (err) {
        console.error('[CanvasWorkspace] failed to get session by id', err);
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    };

    const loadByLessonSlot = async (
      lessonId: string,
      uid: string | undefined,
      slotIndex: number,
      canvasType?: CanvasType
    ) => {
      if (!uid) {
        console.warn('[CanvasWorkspace] no user; cannot create personal session. Waiting for Auth…');
        setLoadingSession(false);
        return;
      }
      try {
        setLoadingSession(true);
        const s = await canvasService.getOrCreateSession(
          lessonId,
          uid,
          slotIndex,
          canvasType ?? 'student'
        );
        if (!cancelled) setSession(s);
      } catch (err) {
        console.error('[CanvasWorkspace] failed to get/create session', err);
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    };

    if (isBySessionId(props)) {
      loadBySessionId(props.sessionId);
    } else {
      loadByLessonSlot(props.lessonId, user?.id, props.slotIndex, props.canvasType);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    (isBySessionId(props) ? props.sessionId : props.lessonId),
    (isBySessionId(props) ? undefined : props.slotIndex),
    (isBySessionId(props) ? undefined : props.canvasType),
    (isBySessionId(props) ? undefined : user?.id),
  ]);

  // --- Load strokes for the session (with offline fallback) -------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session) return;

      try {
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

    return () => {
      cancelled = true;
    };
  }, [session?.id]);

  // --- Online/offline indicator ----------------------------------------------
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

  // --- Lock polling/enforcement ----------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let timer: any;

    const poll = async () => {
      if (!props.lockContext) {
        setEffectiveLock(null);
        return;
      }
      const { classId, lessonId, slotIndex, studentId } = props.lockContext;
      try {
        const lock = await getEffectiveLock(classId, lessonId, slotIndex, studentId);
        if (!cancelled) {
          setEffectiveLock(lock ? { locked: true, lock_until: lock.lock_until ?? null } : null);
        }
      } catch {
        if (!cancelled) setEffectiveLock(null);
      } finally {
        if (!cancelled) {
          timer = setTimeout(poll, props.lockPollMs ?? 20000);
        }
      }
    };

    // Only poll if a lock context is provided
    if (props.lockContext) poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [props.lockContext, props.lockPollMs]);

  // --- Analytics: focus/blur + heartbeat -------------------------------------
  useEffect(() => {
    if (!props.analyticsContext) return;
    if (forcedReadOnly) return;

    let stopHeartbeat: (() => void) | null = null;

    const baseCtx = getAnalyticsCtx();
    // If we still don't have a session id yet, wait for it (effect re-runs on session?.id)
    if (!baseCtx) return;

    const start = () => {
      analyticsService.log({ ...baseCtx, eventType: 'focus' });
      if (stopHeartbeat) stopHeartbeat();
      stopHeartbeat = analyticsService.startHeartbeat(baseCtx, 15000);
    };
    const stop = () => {
      analyticsService.log({ ...baseCtx, eventType: 'blur' });
      if (stopHeartbeat) {
        stopHeartbeat();
        stopHeartbeat = null;
      }
    };
    const onVis = () => (document.visibilityState === 'visible' ? start() : stop());

    window.addEventListener('focus', start);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', onVis);

    // initial
    if (document.visibilityState === 'visible') start();

    return () => {
      window.removeEventListener('focus', start);
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    forcedReadOnly,
    session?.id,
    props.analyticsContext?.userId,
    props.analyticsContext?.classId,
    props.analyticsContext?.courseId,
    props.analyticsContext?.lessonId,
    props.analyticsContext?.slotIndex,
    props.analyticsContext?.sessionId,
  ]);

  // --- Canvas drawing/resize --------------------------------------------------
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
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;

    // Use container width and fixed height (400px) for CSS sizing
    const holder = containerRef.current;
    const widthCss = holder ? holder.clientWidth : canvas.getBoundingClientRect().width || 800;
    const heightCss = holder ? holder.clientHeight || 400 : canvas.getBoundingClientRect().height || 400;

    // Set backing store size
    canvas.width = Math.max(1, Math.floor(widthCss * dpr));
    canvas.height = Math.max(1, Math.floor(heightCss * dpr));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    redraw();
  }, [redraw]);

  useEffect(() => {
    resize();
  }, [resize, strokes.length]);

  // --- Toolbar handlers -------------------------------------------------------
  const handleToolChange = (tool: 'pen' | 'eraser') =>
    setState((s) => ({ ...s, currentTool: tool }));
  const handleColorChange = (color: string) =>
    setState((s) => ({ ...s, currentColor: color }));
  const handleWidthChange = (width: number) =>
    setState((s) => ({ ...s, currentWidth: width }));

  // --- Persist stroke ---------------------------------------------------------
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

    const optimistic: CanvasStroke = {
      ...(stroke as any),
      id: `local_${stroke.stroke_order}_${stroke.timestamp_ms}`,
      created_at: new Date().toISOString(),
    };

    setStrokes((prev) => [...prev, optimistic]);

    try {
      if (isOnline) {
        const saved = await canvasService.saveStroke(stroke);
        // Replace optimistic row with echo
        setStrokes((prev) => prev.map((s) => (s.id === optimistic.id ? saved : s)));
      } else {
        await offlineCanvasService.saveStrokeOffline({ ...(optimistic as any), needs_sync: true });
      }
    } catch (err) {
      console.error('[CanvasWorkspace] pushStroke failed, rolling back', err);
      setStrokes((prev) => prev.filter((s) => s.id !== optimistic.id));
    } finally {
      // Analytics: stroke
      const a = getAnalyticsCtx();
      if (a) {
        analyticsService.log({
          ...a,
          eventType: 'stroke',
          meta: {
            points: points.length,
            tool: state.currentTool,
            width: state.currentWidth,
            color: state.currentColor,
          },
        });
      }
    }
  };

  // --- Pointer handlers -------------------------------------------------------
  const onPointerDown = (e: React.PointerEvent) => {
    if (forcedReadOnly) return;
    if (!session) {
      console.warn('[CanvasWorkspace] pointerDown ignored; no session yet');
      return;
    }
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    drawingPointsRef.current = [
      {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure ?? 1,
        timestamp: Date.now(),
      },
    ];
    setState((s) => ({ ...s, isDrawing: true, startTime: Date.now() }));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (forcedReadOnly || !state.isDrawing) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    drawingPointsRef.current.push({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure ?? 1,
      timestamp: Date.now(),
    });

    // incremental draw for responsiveness
    const ctx = ctxRef.current;
    if (ctx) {
      const pts = drawingPointsRef.current;
      if (pts.length >= 2) {
        const a = pts[pts.length - 2];
        const b = pts[pts.length - 1];
        ctx.save();
        ctx.globalCompositeOperation =
          state.currentTool === 'eraser' ? 'destination-out' : 'source-over';
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
    if (forcedReadOnly || !state.isDrawing) return;
    const points = drawingPointsRef.current.slice();
    drawingPointsRef.current = [];
    setState((s) => ({ ...s, isDrawing: false }));
    await pushStroke(points);
  };

  // --- Undo & clear -----------------------------------------------------------
  const handleUndo = async () => {
    if (forcedReadOnly) return;
    const last = strokes[strokes.length - 1];
    if (!last) return;
    setStrokes((prev) => prev.slice(0, -1));
    try {
      if (last.id && !String(last.id).startsWith('local_')) {
        await canvasService.deleteStroke(last.id);
      }
    } catch (e) {
      console.error('Undo delete failed', e);
    } finally {
      const a = getAnalyticsCtx();
      if (a) analyticsService.log({ ...a, eventType: 'undo' });
    }
  };

  const handleClear = async () => {
    if (forcedReadOnly || !session) return;
    const prev = strokes;
    setStrokes([]);
    try {
      await canvasService.clearCanvas(session.id);
    } catch (e) {
      console.error('Clear server failed, restoring local strokes', e);
      setStrokes(prev);
    } finally {
      const a = getAnalyticsCtx();
      if (a) analyticsService.log({ ...a, eventType: 'clear' });
    }
  };

  const canUndo = !forcedReadOnly && strokes.length > 0;

  // --- Render ----------------------------------------------------------------
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
        <div ref={containerRef} className="relative" style={{ height: 400 }}>
          {loadingSession && (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-500">
              Preparing Canvas…
            </div>
          )}

          {/* Lock overlay (covers canvas and blocks interaction) */}
          {effectiveLock?.locked && (
            <div className="absolute inset-0 z-10 bg-white/55 backdrop-blur-[1px] flex items-center justify-center">
              <div className="px-3 py-1.5 rounded-md border bg-white text-gray-700 text-sm shadow-sm">
                Canvas is locked by your teacher
                {effectiveLock.lock_until ? (
                  <> until {new Date(effectiveLock.lock_until).toLocaleString()}</>
                ) : null}
              </div>
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
    </div>
  );
};

export default CanvasWorkspace;
