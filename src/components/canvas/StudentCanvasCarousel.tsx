import React, { useState } from 'react';
import type { CanvasSession } from '../../types/canvas.types';
import CanvasWorkspace from './CanvasWorkspace';
// New Start: playback
import CanvasPlayback from './CanvasPlayback';
// New End

type Props = {
  sessions: CanvasSession[];
};

const StudentCanvasCarousel: React.FC<Props> = ({ sessions }) => {
  const [idx, setIdx] = useState(0);
  // New Start: per-slide playback toggle
  const [showPlayback, setShowPlayback] = useState(false);
  // New End

  if (!sessions || sessions.length === 0) {
    return <div className="text-sm text-gray-500">No student work yet.</div>;
  }

  const current = sessions[Math.max(0, Math.min(idx, sessions.length - 1))];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          className="px-2 py-1 border rounded disabled:opacity-50"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
        >
          ‹ Prev
        </button>

        <div className="text-sm text-gray-600">
          {idx + 1} / {sessions.length} — {current?.title || 'Student Canvas'}
        </div>

        <button
          className="px-2 py-1 border rounded disabled:opacity-50"
          onClick={() => setIdx((i) => Math.min(sessions.length - 1, i + 1))}
          disabled={idx >= sessions.length - 1}
        >
          Next ›
        </button>
      </div>

      {/* New Start: playback toggle */}
      <div className="mb-2">
        <button
          onClick={() => setShowPlayback((v) => !v)}
          className="px-3 py-2 rounded-md border bg-white text-gray-700"
        >
          {showPlayback ? 'Hide' : 'Show'} Playback
        </button>
      </div>
      {/* New End */}

      <div className="border rounded">
        {/* Old Start: workspace only */}
        {/* <CanvasWorkspace sessionId={current.id} isReadOnly={true} /> */}
        {/* Old End */}

        {/* New Start: keep live (read-only) workspace visible; playback sits below when toggled */}
        <CanvasWorkspace sessionId={current.id} isReadOnly={true} />
        {showPlayback && (
          <div className="mt-3">
            <CanvasPlayback
              sessionIds={[current.id]}
              initialFull
              stepsPerSecond={40}
              // width/height default to 800x400; you can pass numbers to match your layout if desired
            />
          </div>
        )}
        {/* New End */}
      </div>
    </div>
  );
};

export default StudentCanvasCarousel;
