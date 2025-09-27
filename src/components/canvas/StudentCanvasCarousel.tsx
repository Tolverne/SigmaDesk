import React, { useState } from 'react';
import type { CanvasSession } from '../../types/canvas.types';
import CanvasWorkspace from './CanvasWorkspace';

type Props = {
  sessions: CanvasSession[];
};

const StudentCanvasCarousel: React.FC<Props> = ({ sessions }) => {
  const [idx, setIdx] = useState(0);

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

      <div className="border rounded">
        <CanvasWorkspace sessionId={current.id} isReadOnly={true} />
      </div>
    </div>
  );
};

export default StudentCanvasCarousel;
