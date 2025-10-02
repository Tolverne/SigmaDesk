import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { courseService } from '../services/courseService';
import { Course, Topic } from '../types/course.types';
import CourseNavigation from '../components/CourseNavigation';
import Breadcrumb from '../components/Breadcrumb';

const CourseDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    const { signal } = controller;

    const load = async () => {
      if (!courseId) {
        if (mountedRef.current) {
          setCourse(null);
          setTopics([]);
          setIsEnrolled(false);
          setError('Course not found');
          setLoading(false);
        }
        return;
      }

      if (signal.aborted) return;

      setLoading(true);
      setError(null);

      try {
        const [details, enrolled] = await Promise.all([
          courseService.getCourseDetails(courseId, { signal }),
          user ? courseService.checkEnrollment(courseId, user.id, { signal }) : Promise.resolve(false),
        ]);

        if (!mountedRef.current || signal.aborted) return;

        setCourse(details);
        setTopics(details?.topics || []);
        setIsEnrolled(!!enrolled);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('Error loading course:', err);
        if (mountedRef.current && !signal.aborted) {
          const msg = String(err?.message || '');
          if (msg.toLowerCase().includes('not found')) {
            setError('Course not found');
          } else if (msg.toLowerCase().includes('jwt') || msg.toLowerCase().includes('session')) {
            setError('Your session has expired. Please sign in again.');
          } else {
            setError('Failed to load course. Please try again.');
          }
        }
      } finally {
        if (mountedRef.current && !signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, [courseId, user?.id]);

  const startLearning = () => {
    const firstLessonId = topics?.[0]?.lessons?.[0]?.id;
    if (firstLessonId) {
      navigate(`/courses/${courseId}/lessons/${firstLessonId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sigma-blue"></div>
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: 'Courses', path: '/courses' }]} />
        <div className="text-center py-12 bg-red-50 rounded-lg">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-800 mb-2">
            {error === 'Course not found' ? 'Course Not Found' : 'Failed to Load Course'}
          </h2>
          <p className="text-red-600 mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={() => navigate('/courses')}
              className="px-6 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Back to Courses
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return <div className="max-w-7xl mx-auto px-4 py-8">Course not found</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: 'Courses', path: '/courses' },
          { label: course.title },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              {course.title}
            </h1>
            <p className="text-gray-600 mb-6">
              {course.description}
            </p>

            {!isEnrolled ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 mb-2">
                  You are not enrolled in this course.
                </p>
                <p className="text-sm text-blue-700">
                  Contact your administrator to be added to a class for this course.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 mb-4">
                  ✓ You are enrolled in this course
                </p>
                <button
                  onClick={startLearning}
                  className="px-6 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700"
                >
                  Start Learning
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <CourseNavigation topics={topics} courseId={courseId!} />
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;