import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { courseService } from '../services/courseService';
import { supabase } from '../utils/supabase';
import { Lesson } from '../types/course.types';
import Breadcrumb, { BreadcrumbItem } from '../components/Breadcrumb';import SectionCarousel from '../components/lesson/SectionCarousel';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';

const LessonPage: React.FC = () => {
  const { courseId, classId, topicId, lessonId } = useParams<{ 
    courseId: string; 
    classId?: string;
    topicId?: string;
    lessonId: string;
  }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  
  const [className, setClassName] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string | null>(null);
  const [topicName, setTopicName] = useState<string | null>(null);

  // Navigation state
  const [nextLessonId, setNextLessonId] = useState<string | null>(null);
  const [prevLessonId, setPrevLessonId] = useState<string | null>(null);

  // Load class name if classId is present
  useEffect(() => {
    if (!classId) return;

    const controller = new AbortController();
    const { signal } = controller;

    const loadClassName = async () => {
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('name, display_name')
          .eq('id', classId)
          .single();

        if (signal.aborted) return;

        if (error) {
          console.warn('Failed to load class name:', error);
          return;
        }

        setClassName(data.display_name || data.name);
      } catch (err) {
        console.warn('Error loading class name:', err);
      }
    };

    loadClassName();

    return () => controller.abort();
  }, [classId]);

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

        // Extract metadata from lesson data
        const lessonData = data as any;
        if (lessonData?.topics?.courses?.title) {
          setCourseName(lessonData.topics.courses.title);
        }
        if (lessonData?.topics?.title) {
          setTopicName(lessonData.topics.title);
        }

        // Get next/previous lessons in the same topic
        if (lessonData?.topic_id) {
          const { data: siblings } = await supabase
            .from('lessons')
            .select('id, display_order')
            .eq('topic_id', lessonData.topic_id)
            .order('display_order', { ascending: true });

          if (siblings && !signal.aborted) {
            const currentIndex = siblings.findIndex((l: any) => l.id === lessonId);
            if (currentIndex > 0) {
              setPrevLessonId(siblings[currentIndex - 1].id);
            }
            if (currentIndex < siblings.length - 1) {
              setNextLessonId(siblings[currentIndex + 1].id);
            }
          }
        }

        // Check completion status
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

  const handleNextLesson = () => {
    if (!nextLessonId) return;
    
    if (classId) {
      navigate(`/courses/${courseId}/classes/${classId}/lessons/${nextLessonId}`);
    } else {
      navigate(`/courses/${courseId}/lessons/${nextLessonId}`);
    }
  };

  const handlePrevLesson = () => {
    if (!prevLessonId) return;
    
    if (classId) {
      navigate(`/courses/${courseId}/classes/${classId}/lessons/${prevLessonId}`);
    } else {
      navigate(`/courses/${courseId}/lessons/${prevLessonId}`);
    }
  };

  // Build breadcrumb items with full context
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Courses', path: '/courses' },
    { 
      label: courseName || 'Course', 
      path: courseId ? `/courses/${courseId}` : '/courses' 
    },
  ];

  // Add class breadcrumb for teachers
  if (classId && className) {
    breadcrumbItems.push({
      label: className,
      path: `/courses/${courseId}/classes/${classId}`,
    });
  }

  // Add topic breadcrumb if available
  if (topicId && topicName) {
    const topicPath = classId 
      ? `/courses/${courseId}/classes/${classId}/topics/${topicId}`
      : `/courses/${courseId}/topics/${topicId}`;
    breadcrumbItems.push({
      label: topicName,
      path: topicPath,
    });
  }

  // Add current lesson (no path - it's the current page)
breadcrumbItems.push({ label: lesson?.title || 'Lesson' });


  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-io-primary"></div>
      </div>
    );
  }

  if (error && !lesson) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={breadcrumbItems} />
        <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-800 mb-2">
            {error === 'Lesson not found' ? 'Lesson Not Found' : 'Failed to Load Lesson'}
          </h2>
          <p className="text-red-600 mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={() => navigate(`/courses/${courseId}`)}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
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
    return <div className="max-w-7xl mx-auto px-4 py-8">Lesson not found</div>;
  }

  const latexSource =
    (lesson as any).content_latex ??
    (lesson as any).content ??
    (lesson as any).latex ??
    (lesson as any).body ??
    '';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb items={breadcrumbItems} />

      {/* Class context banner for teachers */}
      {classId && className && profile?.role === 'teacher' && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <p className="text-sm text-blue-800">
            Teaching: <span className="font-semibold">{className}</span>
          </p>
        </div>
      )}

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

        {/* Content */}
        <div className="p-6 space-y-6">
          <SectionCarousel 
            lessonId={lesson.id} 
            latexSource={latexSource}
            classId={classId}
          />
        </div>

        {/* Navigation */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (classId) {
                    navigate(`/courses/${courseId}/classes/${classId}`);
                  } else {
                    navigate(`/courses/${courseId}`);
                  }
                }}
                className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                {classId ? 'Back to Class' : 'Back to Course'}
              </button>
              
              {prevLessonId && (
                <button
                  onClick={handlePrevLesson}
                  className="flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous Lesson
                </button>
              )}
            </div>

            {nextLessonId && (
              <button
                onClick={handleNextLesson}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700"
              >
                Next Lesson
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonPage;