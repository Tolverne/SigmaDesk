import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CanvasState, CanvasStroke, Point, STUDENT_COLORS, STROKE_WIDTHS } from '../../types/canvas.types';
import { canvasService, offlineCanvasService } from '../../services/canvasService';
import CanvasToolbar from './CanvasToolbar';
import { useAuth } from '../../contexts/AuthContext';

interface CanvasWorkspaceProps {
  lessonId: string;
  slotIndex: number;          // NEW: which \workskip slot this canvas belongs to
  sessionId?: string;         // optional (teacher view)
  isReadOnly?: boolean;
  className?: string;
}

function pointsToPathD(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  const move = `M ${first.x} ${first.y}`;
  const lines = rest.map((p) => `L ${p.x} ${p.y}`).join(' ');
  return `${move} ${lines}`;
}

const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  lessonId,
  slotIndex,
  sessionId,
  isReadOnly = false,
  className = '',
}) => {
  const { user } = useAuth();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isMounted = useRef(true);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [session, setSession] = useState<{ id: string } | null>(null);
  const [strokeOrder, setStrokeOrder] = useState<number>(0);

  const [canvasState, setCanvasState] = useState<CanvasState>({
    currentTool: 'pen',
    currentColor: STUDENT_COLORS[0],
    currentWidth: STROKE_WIDTHS[1],
    isDrawing: false,
    startTime: Date.now(),
    strokes: [],
    undoStack: [],
  });

  const initSession = useCallback(async () => {
    if (!lessonId) return;
    try {
      if (sessionId) {
        const s = await canvasService.getCanvasSessionById(sessionId);
        setSession(s);
        const strokes = await canvasService.getSessionStrokes(s.id);
        setStrokeOrder(strokes.length);
        setCanvasState((prev) => ({ ...prev, strokes }));
      } else if (user) {
        const s = await canvasService.getCanvasSession(lessonId, user.id, slotIndex);
        setSession(s);
        const strokes = await canvasService.getSessionStrokes(s.id);
        setStrokeOrder(strokes.length);
        setCanvasState((prev) => ({ ...prev, strokes, startTime: Date.now() }));
      }
    } catch (err) {
      console.error('Canvas init failed:', err);
    }
  }, [lessonId, sessionId, slotIndex, user]);

  useEffect(() => {
    isMounted.current = true;
    initSession();
    return () => {
      isMounted.current = false;
    };
  }, [initSession]);

  useEffect(() => {
    const onOnline = async () => {
      setIsOnline(true);
      try {
        await offlineCanvasService.syncPendingData();
        if (session?.id) {
          const strokes = await canvasService.getSessionStrokes(session.id);
          if (!isMounted.current) return;
          setStrokeOrder(strokes.length);
          setCanvasState((p) => ({ ...p, strokes }));
        }
      } catch (e) {
        console.error('Offline sync failed:', e);
      }
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [session?.id]);

  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  const startStroke = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isReadOnly || !session?.id) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);

    const rect = svgRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left || 0);
    const y = e.clientY - (rect?.top || 0);

    setCurrentPoints([{ x, y, timestamp: Date.now() }]);
    setCanvasState((p) => ({ ...p, isDrawing: true }));
  };

  const extendStroke = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isReadOnly || !session?.id) return;
    if (!canvasState.isDrawing) return;

    const rect = svgRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left || 0);
    const y = e.clientY - (rect?.top || 0);

    setCurrentPoints((pts) => [...pts, { x, y, timestamp: Date.now() }]);
  };

  const endStroke = async (e: React.PointerEvent<SVGSVGElement>) => {
    if (!canvasState.isDrawing || !session?.id) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);

    const points = currentPoints;
    setCurrentPoints([]);
    setCanvasState((p) => ({ ...p, isDrawing: false }));
    if (points.length < 2) return;

    const d = pointsToPathD(points);
    const nextOrder = strokeOrder + 1;
    const stroke: Omit<CanvasStroke, 'id' | 'created_at'> = {
      session_id: session.id,
      stroke_data: { d, points },
      stroke_color: canvasState.currentColor,
      stroke_width: canvasState.currentWidth,
      tool_type: canvasState.currentTool,
      timestamp_ms: Date.now() - canvasState.startTime,
      stroke_order: nextOrder,
    };

    const optimistic: CanvasStroke = {
      ...stroke,
      id: `temp_${Date.now()}`,
      created_at: new Date().toISOString(),
    } as CanvasStroke;

    setCanvasState((p) => ({ ...p, strokes: [...p.strokes, optimistic] }));
    setStrokeOrder(nextOrder);

    try {
      if (isOnline) {
        const saved = await canvasService.saveStroke(stroke);
        setCanvasState((p) => ({
          ...p,
          strokes: p.strokes.map((s) => (s.id === optimistic.id ? saved : s)),
        }));
      } else {
        await offlineCanvasService.saveStrokeOffline({ ...(optimistic as any), needs_sync: true });
      }
    } catch (err) {
      console.error('Failed to save stroke:', err);
    }
  };

  const handleToolChange = (tool: 'pen' | 'eraser') =>
    setCanvasState((p) => ({ ...p, currentTool: tool }));

  const handleColorChange = (color: string) =>
    setCanvasState((p) => ({ ...p, currentColor: color }));

  const handleWidthChange = (width: number) =>
    setCanvasState((p) => ({ ...p, currentWidth: width }));

  const handleUndo = async () => {
    if (isReadOnly) return;
    setCanvasState((p) => {
      const newStrokes = [...p.strokes];
      newStrokes.pop();
      return { ...p, strokes: newStrokes };
    });
    setStrokeOrder((o) => Math.max(0, o - 1));
    // Optional: also delete last persisted stroke if needed (best-effort)
  };

  const handleClear = async () => {
    if (isReadOnly || !session?.id) return;
    setCanvasState((p) => ({ ...p, strokes: [] }));
    setStrokeOrder(0);
    try {
      await canvasService.clearCanvas(session.id);
    } catch (e) {
      console.error('Failed to clear canvas:', e);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <CanvasToolbar
        canvasState={canvasState}
        onToolChange={handleToolChange}
        onColorChange={handleColorChange}
        onWidthChange={handleWidthChange}
        onUndo={handleUndo}
        onClear={handleClear}
        canUndo={canvasState.strokes.length > 0}
        isOnline={isOnline}
      />

      <div className="p-3">
        <div className="border rounded-lg overflow-hidden bg-gray-50">
          <svg
            ref={svgRef}
            width="100%"
            height="400"
            className="touch-none bg-white"
            onPointerDown={startStroke}
            onPointerMove={extendStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          >
            {canvasState.strokes.map((s) => (
              <path
                key={s.id}
                d={s.stroke_data.d}
                fill="none"
                stroke={s.tool_type === 'eraser' ? '#FFFFFF' : s.stroke_color}
                strokeWidth={s.stroke_width}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ mixBlendMode: s.tool_type === 'eraser' ? ('destination-out' as any) : 'normal' }}
              />
            ))}

            {/* live preview */}
            {canvasState.isDrawing && currentPoints.length > 1 && (
              <path
                d={pointsToPathD(currentPoints)}
                fill="none"
                stroke={canvasState.currentTool === 'eraser' ? '#FFFFFF' : canvasState.currentColor}
                strokeWidth={canvasState.currentWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ mixBlendMode: canvasState.currentTool === 'eraser' ? ('destination-out' as any) : 'normal' }}
              />
            )}
          </svg>
        </div>

        <div className="flex justify-between items-center p-2 bg-gray-50 text-xs text-gray-600 rounded-b-lg">
          <span>Strokes: {canvasState.strokes.length}</span>
          <span className="flex items-center">
            <span className={`w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-green-500' : 'bg-orange-500'}`} />
            {isOnline ? 'Online' : 'Offline (sync later)'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CanvasWorkspace;
