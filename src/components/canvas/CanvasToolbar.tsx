import React from 'react';
import { Pen, Eraser, Undo, RotateCcw, Palette } from 'lucide-react';
import { CanvasState, STUDENT_COLORS, STROKE_WIDTHS } from '../../types/canvas.types';

interface CanvasToolbarProps {
  canvasState: CanvasState;
  onToolChange: (tool: 'pen' | 'eraser') => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
  isOnline: boolean;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  canvasState,
  onToolChange,
  onColorChange,
  onWidthChange,
  onUndo,
  onClear,
  canUndo,
  isOnline,
}) => {
  return (
    <div className="canvas-toolbar flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-t-lg">
      {/* Left: tools */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onToolChange('pen')}
          className={`px-3 py-2 rounded-md flex items-center space-x-1 ${
            canvasState.currentTool === 'pen' ? 'bg-sigma-blue text-white' : 'bg-white text-gray-700 border'
          }`}
          aria-label="Pen tool"
        >
          <Pen className="w-4 h-4" />
          <span className="text-sm">Pen</span>
        </button>

        <button
          onClick={() => onToolChange('eraser')}
          className={`px-3 py-2 rounded-md flex items-center space-x-1 ${
            canvasState.currentTool === 'eraser' ? 'bg-sigma-blue text-white' : 'bg-white text-gray-700 border'
          }`}
          aria-label="Eraser tool"
        >
          <Eraser className="w-4 h-4" />
          <span className="text-sm">Eraser</span>
        </button>
      </div>

      {/* Middle: colors & widths */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Palette className="w-4 h-4 text-gray-500" />
          <div className="flex items-center space-x-1">
            {STUDENT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onColorChange(c)}
                className={`w-5 h-5 rounded-full border ${
                  canvasState.currentColor === c ? 'ring-2 ring-offset-2 ring-sigma-blue' : ''
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">Width</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={canvasState.currentWidth}
            onChange={(e) => onWidthChange(Number(e.target.value))}
          >
            {STROKE_WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w}px
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: actions & status */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="px-3 py-2 rounded-md bg-white text-gray-700 border disabled:opacity-50"
          aria-label="Undo"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onClick={onClear}
          className="px-3 py-2 rounded-md bg-white text-gray-700 border"
          aria-label="Clear"
          title="Clear all"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div
          className={`ml-3 text-xs px-2 py-1 rounded ${
            isOnline ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
          }`}
          title={isOnline ? 'Online' : 'Offline (strokes will sync)'}
        >
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>
    </div>
  );
};

export default CanvasToolbar;
