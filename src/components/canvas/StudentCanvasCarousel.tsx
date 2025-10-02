import React, { useState } from 'react';
import type { CanvasSession } from '../../types/canvas.types';
import CanvasViewer from './CanvasViewer';

type Props = {
  sessions: CanvasSession[];
};

const StudentCanvasCarousel: React.FC<Props> = ({ sessions }) => {
  const [idx, setIdx] = useState(0);

  if (!sessions || sessions.length === 0) {
    return <div className="text-sm text-gray-500 p-4">No student work yet.</div>;
  }

  const current = sessions[Math.max(0, Math.min(idx, sessions.length - 1))];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 border rounded-lg">
        <button
          className="px-4 py-2 border rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
        >
          ‹ Previous
        </button>

        <div className="text-sm font-medium text-gray-700">
          Student {idx + 1} of {sessions.length}
          {current?.title && <span className="text-gray-500 ml-2">— {current.title}</span>}
        </div>

        <button
          className="px-4 py-2 border rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          onClick={() => setIdx((i) => Math.min(sessions.length - 1, i + 1))}
          disabled={idx >= sessions.length - 1}
        >
          Next ›
        </button>
      </div>

      <CanvasViewer
        sessionId={current.id}
        isReadOnly={true}
        showModeToggle={true}
        defaultMode="draw"
      />
    </div>
  );
};

export default StudentCanvasCarousel;