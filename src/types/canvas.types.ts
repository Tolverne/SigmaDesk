export interface CanvasSession {
    id: string;
    lesson_id: string;
    user_id: string;
    title: string;
    canvas_width: number;
    canvas_height: number;
    slot_index: number;          // NEW: identifies which \workskip this session belongs to
    created_at: string;
    updated_at: string;
  }
  
  export interface SVGPath {
    d: string;
    points: Point[];
  }
  
  export interface Point {
    x: number;
    y: number;
    pressure?: number;
    timestamp?: number;
  }
  
  export interface CanvasStroke {
    id: string;
    session_id: string;
    stroke_data: SVGPath;
    stroke_color: string;
    stroke_width: number;
    tool_type: 'pen' | 'eraser';
    timestamp_ms: number;
    stroke_order: number;
    created_at: string;
  }
  
  export interface CanvasState {
    currentTool: 'pen' | 'eraser';
    currentColor: string;
    currentWidth: number;
    isDrawing: boolean;
    startTime: number;
    strokes: CanvasStroke[];
    undoStack: CanvasStroke[];
  }
  
  export interface PlaybackState {
    isPlaying: boolean;
    currentTime: number;
    totalDuration: number;
    playbackSpeed: number;
    visibleStrokes: CanvasStroke[];
  }
  
  export const STUDENT_COLORS = [
    '#000000',
    '#0066CC',
    '#6B73FF',
    '#9D4EDD',
    '#F72585',
    '#4361EE',
    '#4CC9F0',
    '#7209B7',
    '#560BAD',
  ];
  
  export const TEACHER_COLORS = ['#DC2626', '#16A34A'];
  
  export const STROKE_WIDTHS = [1, 2, 3, 5, 8];
  