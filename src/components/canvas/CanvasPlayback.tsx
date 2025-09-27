import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { CanvasStroke, PlaybackState } from '../../types/canvas.types';

interface CanvasPlaybackProps {
  strokes: CanvasStroke[];
  width?: number;
  height?: number;
  className?: string;
}

function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const CanvasPlayback: React.FC<CanvasPlaybackProps> = ({
  strokes,
  width = 800,
  height = 400,
  className = '',
}) => {
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    totalDuration: 0,
    playbackSpeed: 1,
    visibleStrokes: [],
  });

  // FIX: initialize refs with null and allow null in the type
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Set total duration when strokes change
  useEffect(() => {
    if (strokes.length === 0) {
      setPlaybackState((p) => ({ ...p, totalDuration: 0, currentTime: 0, visibleStrokes: [] }));
      return;
    }
    const totalDuration = Math.max(...strokes.map((s) => s.timestamp_ms));
    setPlaybackState((p) => ({ ...p, totalDuration, currentTime: 0, visibleStrokes: [] }));
  }, [strokes]);

  const tick = useCallback(
    (t: number) => {
      // FIX: handle null baseline explicitly
      const baseline = lastTimeRef.current === null ? t : lastTimeRef.current;
      const delta = (t - baseline) * (playbackState.playbackSpeed || 1);
      lastTimeRef.current = t;

      setPlaybackState((p) => {
        const nextTime = Math.min(p.currentTime + delta, p.totalDuration);
        const visible = strokes.filter((s) => s.timestamp_ms <= nextTime);
        const stillPlaying = nextTime < p.totalDuration;
        return {
          ...p,
          currentTime: nextTime,
          visibleStrokes: visible,
          isPlaying: stillPlaying,
        };
      });

      if (playbackState.isPlaying) {
        animationRef.current = requestAnimationFrame(tick);
      }
    },
    [playbackState.isPlaying, playbackState.playbackSpeed, strokes]
  );

  useEffect(() => {
    if (playbackState.isPlaying) {
      // FIX: set to null, not undefined
      lastTimeRef.current = null;
      animationRef.current = requestAnimationFrame(tick);
      return () => {
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      };
    }
  }, [playbackState.isPlaying, tick]);

  const play = () => setPlaybackState((p) => ({ ...p, isPlaying: true }));
  const pause = () => setPlaybackState((p) => ({ ...p, isPlaying: false }));
  const reset = () =>
    setPlaybackState((p) => ({ ...p, isPlaying: false, currentTime: 0, visibleStrokes: [] }));
  const skipBack = () =>
    setPlaybackState((p) => ({ ...p, currentTime: Math.max(0, p.currentTime - 2000) }));
  const skipForward = () =>
    setPlaybackState((p) => ({
      ...p,
      currentTime: Math.min(p.totalDuration, p.currentTime + 2000),
    }));

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-t-lg">
        <div className="flex items-center space-x-2">
          {!playbackState.isPlaying ? (
            <button
              onClick={play}
              className="px-3 py-2 rounded-md bg-sigma-blue text-white flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>Play</span>
            </button>
          ) : (
            <button
              onClick={pause}
              className="px-3 py-2 rounded-md bg-gray-700 text-white flex items-center space-x-2"
            >
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </button>
          )}

          <button
            onClick={reset}
            className="px-3 py-2 rounded-md bg-white text-gray-700 border flex items-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>

          <button
            onClick={skipBack}
            className="px-3 py-2 rounded-md bg-white text-gray-700 border flex items-center space-x-2"
          >
            <SkipBack className="w-4 h-4" />
            <span>-2s</span>
          </button>

          <button
            onClick={skipForward}
            className="px-3 py-2 rounded-md bg-white text-gray-700 border flex items-center space-x-2"
          >
            <SkipForward className="w-4 h-4" />
            <span>+2s</span>
          </button>
        </div>

        <div className="text-xs text-gray-600">
          {formatTime(playbackState.currentTime)} / {formatTime(playbackState.totalDuration)}
        </div>
      </div>

      {/* Playback canvas */}
      <div className="p-3">
        <div className="border rounded-lg overflow-hidden bg-gray-50">
          <svg width={width} height={height} className="bg-white">
            {playbackState.visibleStrokes.map((s) => (
              <path
                key={s.id}
                d={s.stroke_data.d}
                fill="none"
                stroke={s.tool_type === 'eraser' ? '#FFFFFF' : s.stroke_color}
                strokeWidth={s.stroke_width}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  mixBlendMode: s.tool_type === 'eraser' ? ('destination-out' as any) : 'normal',
                }}
              />
            ))}
          </svg>
        </div>

        {/* Stats */}
        <div className="mt-4 pt-2 border-t border-gray-200 text-sm text-gray-600 flex justify-center space-x-6">
          <span>Strokes: {strokes.length}</span>
          <span>Visible: {playbackState.visibleStrokes.length}</span>
          <span>Duration: {formatTime(playbackState.totalDuration)}</span>
        </div>
      </div>
    </div>
  );
};

export default CanvasPlayback;