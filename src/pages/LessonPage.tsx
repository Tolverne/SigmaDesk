import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { courseService } from '../services/courseService';
import { supabase } from '../utils/supabase';
import { Lesson } from '../types/course.types';
import Breadcrumb from '../components/Breadcrumb';
import CanvasWorkspace from '../components/canvas/CanvasWorkspace';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';

const WORKSKIP_REGEX = /\\workskip\b/g; // matches \workskip markers in LaTeX

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function splitByWorkskip(latex: string): Array<{ type: 'text' | 'canvas'; content?: string; index?: number }> {
  const parts: Array<{ type: 'text' | 'canvas'; content?: string; index?: number }> = [];
  if (!latex || !latex.length) return [{ type: 'text', content: '' }];

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let slot = 0;

  while ((match = WORKSKIP_REGEX.exec(latex)) !== null) {
    const textChunk = latex.slice(lastIndex, match.index);
    if (textChunk) parts.push({ type: 'text', content: textChunk });
    parts.push({ type: 'canvas', index: slot });
    slot += 1;
    lastIndex = match.index + match[0].length;
  }

  const tail = latex.slice(lastIndex);
  if (tail) parts.push({ type: 'text', content: tail });

  if (parts.length === 0) return [{ type: 'text', content: latex }];

  return parts;
}

const LessonPage: React.FC = () => {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!lessonId) return;

    const controller = new AbortController();
    const { signal } = controller;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await courseService.getLesson(lessonId);
        if (signal.aborted) return;
        setLesson(data);

        if (user?.id) {
          try {
            const { data: prog } = await supabase
              .from('user_progress')
              .select('is_completed')
              .eq('user_id', user.id)
              .eq('lesson_id', lessonId)
              .maybeSingle();

            if (!signal.aborted) setIsCompleted(!!prog?.is_completed);
          } catch {
            if (!signal.aborted) setIsCompleted(false);
          }
        } else {
          setIsCompleted(false);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('Error loading lesson:', err);
        if (!signal.aborted) {
          const msg = String(err?.message || '').toLowerCase();
          if (msg.includes('not found')) setError('Lesson not found');
          else if (msg.includes('jwt') || msg.includes('session')) setError('Your session has expired. Please sign in again.');
          else setError('Failed to load lesson. Please try again.');
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [lessonId, user?.id]);

  const handleMarkComplete = async () => {
    if (!lessonId || !user || updating) return;

    setUpdating(true);
    try {
      await courseService.updateProgress(lessonId, user.id, !isCompleted);
      setIsCompleted((prev) => !prev);
    } catch (err) {
      console.error('Error updating progress:', err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sigma-blue"></div>
      </div>
    );
  }

  if (error && !lesson) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Breadcrumb items={[
          { label: 'Courses', path: '/courses' },
          { label: 'Course', path: `/courses/${courseId}` },
        ]} />
        <div className="text-center py-12 bg-red-50 rounded-lg">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-800 mb-2">
            {error === 'Lesson not found' ? 'Lesson Not Found' : 'Failed to Load Lesson'}
          </h2>
          <p className="text-red-600 mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={() => navigate(`/courses/${courseId}`)}
              className="px-6 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Back to Course
            </button>
            <button
              onClick={() => navigate('/courses')}
              className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Browse Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return <div className="max-w-4xl mx-auto px-4 py-8">Lesson not found</div>;
  }

  // Split LaTeX on \workskip markers
  const segments = splitByWorkskip(String((lesson as any).content_latex || ''));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb items={[
        { label: 'Courses', path: '/courses' },
        { label: 'Course', path: `/courses/${courseId}` },
        { label: lesson.title }
      ]} />

      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                {lesson.title}
              </h1>
              <p className="text-gray-600">{lesson.description}</p>
              <p className="text-sm text-gray-500 mt-2">
                Estimated time: {lesson.estimated_minutes} minutes
              </p>
            </div>
            <button
              onClick={handleMarkComplete}
              disabled={!user || updating}
              className={`flex items-center px-4 py-2 rounded-md transition-colors ${
                isCompleted
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } ${(!user || updating) ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <CheckCircle className={`w-5 h-5 mr-2 ${isCompleted ? 'fill-current' : ''}`} />
              {isCompleted ? 'Completed' : updating ? 'Updating...' : 'Mark Complete'}
            </button>
          </div>
        </div>

        {/* Content + canvases */}
        <div className="p-6 space-y-6">
          {segments.map((seg, i) =>
            seg.type === 'text' ? (
              <div key={`t-${i}`} className="bg-gray-50 rounded-lg p-4">
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: escapeHtml(seg.content || '').replace(/\n/g, '<br/>'),
                  }}
                />
              </div>
            ) : (
              <div key={`c-${seg.index}`} className="bg-white rounded-lg">
                <h3 className="text-md font-semibold text-gray-700 mb-2">
                  Working Area {Number(seg.index) + 1}
                </h3>
                <CanvasWorkspace
                  lessonId={lesson.id}
                  slotIndex={Number(seg.index)}
                  className="mb-2"
                />
              </div>
            )
          )}

          {/* If no \workskip appeared and you still want a single default canvas, uncomment below:
          {segments.every(s => s.type === 'text') && (
            <div className="bg-white rounded-lg">
              <h3 className="text-md font-semibold text-gray-700 mb-2">Working Area</h3>
              <CanvasWorkspace lessonId={lesson.id} slotIndex={0} className="mb-2" />
            </div>
          )} */}
        </div>

        {/* Navigation */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-between">
            <button
              onClick={() => navigate(`/courses/${courseId}`)}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back to Course
            </button>
            <button
              className="flex items-center px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700"
              disabled
            >
              Next Lesson
              <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonPage;
