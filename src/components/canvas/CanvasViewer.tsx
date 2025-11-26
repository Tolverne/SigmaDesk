import React, { useState, useEffect, useRef } from 'react';
import CanvasWorkspace from './CanvasWorkspace';
import CanvasPlayback from './CanvasPlayback';

type CanvasViewerProps = {
  sessionId?: string;
  sessionIds?: string[]; // For merged playback (teacher examples)
  isReadOnly: boolean;
  className?: string;
  defaultMode?: 'draw' | 'playback';
  showModeToggle?: boolean;
  canvasType?: 'student' | 'teacher_example';
};

const CanvasViewer: React.FC<CanvasViewerProps> = ({
  sessionId,
  sessionIds,
  isReadOnly,
  className = '',
  defaultMode = 'draw',
  showModeToggle = true,
  canvasType = 'student',
}) => {
  const [mode, setMode] = useState<'draw' | 'playback'>(defaultMode);
  const [surfaceSize, setSurfaceSize] = useState({ width: 800, height: 400 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container size for playback
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setSurfaceSize({
          width: Math.round(rect.width) || 800,
          height: 400,
        });
      }
    };
    
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const playbackSessionIds = sessionIds || (sessionId ? [sessionId] : []);

  if (!sessionId && !sessionIds?.length) {
    return (
      <div className={className}>
        <div className="text-sm text-gray-500 p-4">No canvas session available</div>
      </div>
    );
  }

  return (
    <div className={className}>
      {showModeToggle && (
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setMode('draw')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              mode === 'draw'
                ? 'bg-primary text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {isReadOnly ? '📋 View' : '✏️ Draw'}
          </button>
          <button
            onClick={() => setMode('playback')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              mode === 'playback'
                ? 'bg-primary text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            ▶️ Playback
          </button>
        </div>
      )}

      <div ref={containerRef}>
        {mode === 'draw' ? (
          sessionId ? (
            <CanvasWorkspace sessionId={sessionId} isReadOnly={isReadOnly} />
          ) : (
            <div className="text-sm text-gray-500 p-4">
              Draw mode requires a single session
            </div>
          )
        ) : (
          <CanvasPlayback
            sessionIds={playbackSessionIds}
            width={surfaceSize.width}
            height={surfaceSize.height}
            initialFull={true}
            stepsPerSecond={40}
          />
        )}
      </div>
    </div>
  );
};

export default CanvasViewer;