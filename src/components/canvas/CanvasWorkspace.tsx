/* eslint-disable no-console */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { CanvasSession, CanvasStroke, CanvasType, CanvasState, Point, SVGPath } from '../../types/canvas.types';
import { STUDENT_COLORS, STROKE_WIDTHS } from '../../types/canvas.types';
import { canvasService, offlineCanvasService } from '../../services/canvasService';
import CanvasToolbar from './CanvasToolbar';

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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingPointsRef = useRef<Point[]>([]);
  const nextOrderRef = useRef<number>(1);

  // Create or fetch session (depending on prop shape)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (isBySessionId(props)) {
          const s = await canvasService.getCanvasSessionById(props.sessionId);
          if (!cancelled) setSession(s);
        } else {
          if (!user) return;
          const s = await canvasService.getOrCreateSession(
            props.lessonId,
            user.id,
            props.slotIndex,
            props.canvasType ?? 'student'
          );
          if (!cancelled) setSession(s);
        }
      } catch (err) {
        console.error('CanvasWorkspace: failed to get/create session', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, props]);

  // Load strokes for the session (with offline fallback)
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
        console.warn('Failed to load online strokes; trying offline cache…', err);
        try {
          const offline = await offlineCanvasService.getOfflineStrokes(session.id);
          if (!cancelled && offline?.length) {
            setStrokes(offline as CanvasStroke[]);
            nextOrderRef.current = (offline[offline.length - 1]?.stroke_order ?? 0) + 1;
          }
        } catch (e) {
          console.error('Offline strokes fetch also failed', e);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [session]);

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
  const redraw = () => {
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
  };

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor((rect.height || 400) * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.scale(dpr, dpr);
    redraw();
  }, [strokes, state.currentColor, state.currentTool, state.currentWidth]);

  useEffect(() => {
    resize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

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
    setStrokes((prev) => [...prev, optimistic]);

    try {
      if (isOnline) {
        const saved = await canvasService.saveStroke(stroke);
        setStrokes((prev) => prev.map((s) => (s.id === optimistic.id ? saved : s)));
      } else {
        await offlineCanvasService.saveStrokeOffline({ ...(optimistic as any), needs_sync: true });
      }
    } catch (err) {
      console.error('Failed to persist stroke', err);
      // rollback optimistic insert
      setStrokes((prev) => prev.filter((s) => s.id !== optimistic.id));
    }
  };

  // Pointer handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    drawingPointsRef.current = [
      { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure ?? 1, timestamp: Date.now() },
    ];
    setState((s) => ({ ...s, isDrawing: true, startTime: Date.now() }));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (readOnly) return;
    if (!state.isDrawing) return;
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
    if (readOnly) return;
    if (!state.isDrawing) return;
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
        <div className="relative" style={{ height: 400 }}>
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
