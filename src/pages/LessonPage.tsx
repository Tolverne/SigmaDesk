import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { courseService } from '../services/courseService';
import { supabase } from '../utils/supabase';
import { Lesson } from '../types/course.types';
import Breadcrumb from '../components/Breadcrumb';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';

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
        // Fetch lesson
        const data = await courseService.getLesson(lessonId, { signal });
        if (signal.aborted) return;
        setLesson(data);

        // Fetch user progress (separate, lightweight)
        if (user?.id) {
          try {
            const { data: prog } = await supabase
              .from('user_progress')
              .select('is_completed')
              .eq('user_id', user.id)
              .eq('lesson_id', lessonId)
              .maybeSingle();

            if (!signal.aborted) setIsCompleted(!!prog?.is_completed);
          } catch (e) {
            // non-fatal
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
          if (msg.includes('not found')) {
            setError('Lesson not found');
          } else if (msg.includes('jwt') || msg.includes('session')) {
            setError('Your session has expired. Please sign in again.');
          } else {
            setError('Failed to load lesson. Please try again.');
          }
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

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sigma-blue"></div>
      </div>
    );
  }

  // Error / Not found state
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
          <p className="text-red-600 mb-6">
            {error}
          </p>
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb items={[
        { label: 'Courses', path: '/courses' },
        { label: 'Course', path: `/courses/${courseId}` },
        { label: lesson.title }
      ]} />

      <div className="bg-white rounded-lg shadow">
        {/* Lesson Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                {lesson.title}
              </h1>
              <p className="text-gray-600">
                {lesson.description}
              </p>
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

        {/* Lesson Content */}
        <div className="p-6">
          {lesson.video_url && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Video</h2>
              <div className="bg-gray-100 rounded-lg p-4 text-center">
                <p className="text-gray-600">
                  Video player will be implemented in Phase 4
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  URL: {lesson.video_url}
                </p>
              </div>
            </div>
          )}

          {lesson.content_latex && (
            <div className="prose max-w-none">
              <h2 className="text-lg font-semibold mb-3">Content</h2>
              <div className="bg-gray-50 rounded-lg p-6">
                {/* Basic rendering - will be enhanced with LaTeX support */}
                <div
                  dangerouslySetInnerHTML={{
                    __html: lesson.content_latex.replace(/\n/g, '<br/>'),
                  }}
                />
              </div>
            </div>
          )}

          {!lesson.content_latex && !lesson.video_url && (
            <div className="text-center py-12 text-gray-500">
              <p>This lesson will have interactive canvas content.</p>
              <p className="text-sm mt-2">Canvas implementation coming in Phase 3!</p>
            </div>
          )}
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
