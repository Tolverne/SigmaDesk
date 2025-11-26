import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { canvasService } from '../services/canvasService';
import type { CanvasSession, CanvasStroke } from '../types/canvas.types';
import CanvasPlayback from '../components/canvas/CanvasPlayback';
import Breadcrumb from '../components/Breadcrumb';
import { User, Clock, Calendar, Hash } from 'lucide-react';

const TeacherCanvasReview: React.FC = () => {
  const { lessonId, sessionId } = useParams<{ lessonId: string; sessionId?: string }>();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<(CanvasSession & { user_name: string })[]>([]);
  const [strokes, setStrokes] = useState<CanvasStroke[]>([]);
  const [activeSession, setActiveSession] = useState<CanvasSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!lessonId) return;
      try {
        if (sessionId) {
          const s = await canvasService.getCanvasSessionById(sessionId);
          setActiveSession(s);
          const st = await canvasService.getSessionStrokes(s.id);
          setStrokes(st);
        } else {
          const list = await canvasService.getStudentSessions(lessonId);
          setSessions(list);
        }
      } catch (e) {
        console.error('Teacher review load failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [lessonId, sessionId]);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-io-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb items={[
        { label: 'Courses', path: '/courses' },
        { label: 'Teacher Review' },
      ]} />

      {!sessionId ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Canvas Sessions for Lesson</h1>
          {sessions.length === 0 ? (
            <p className="text-gray-600">No student canvas sessions found.</p>
          ) : (
            <div className="divide-y">
              {sessions.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">{s.user_name}</div>
                      <div className="text-xs text-gray-500 flex items-center space-x-3">
                        <span className="flex items-center"><Hash className="w-3 h-3 mr-1" />Slot {s.slot_index + 1}</span>
                        <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" />{new Date(s.created_at).toLocaleDateString()}</span>
                        <span className="flex items-center"><Clock className="w-3 h-3 mr-1" />{new Date(s.updated_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/teacher/canvas/${lessonId}/${s.id}`}
                    className="px-3 py-2 bg-primary text-white rounded-md hover:bg-blue-700"
                  >
                    Review
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Canvas Playback</h1>
            <button
              onClick={() => navigate(-1)}
              className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Back
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <CanvasPlayback strokes={strokes} />
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherCanvasReview;