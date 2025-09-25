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

  // A nonce to trigger reloads (if you add a retry button later)
  const [reloadNonce] = useState(0);

  // keep a ref to detect unmount and avoid state updates after abort
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Abort controller for this load
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
        // Load course details and enrollment in parallel
        const [details, enrolled] = await Promise.all([
          courseService.getCourseDetails(courseId, { signal }),
          user ? courseService.checkEnrollment(courseId, user.id, { signal }) : Promise.resolve(false),
        ]);

        if (!mountedRef.current || signal.aborted) return;

        setCourse(details);
        setTopics(details?.topics || []);
        setIsEnrolled(!!enrolled);
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          // silent on abort
          return;
        }
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
    // Reload when the course or user changes (enrollment depends on user)
  }, [courseId, user?.id, reloadNonce]);

  const handleEnroll = async () => {
    if (!user || !courseId) {
      alert('Please sign in to enroll');
      navigate('/login');
      return;
    }

    try {
      await courseService.enrollInCourse(courseId, user.id);
      if (mountedRef.current) {
        setIsEnrolled(true);
      }
      alert('Successfully enrolled!');
    } catch (error: any) {
      alert(error?.message || 'Failed to enroll');
    }
  };

  const startLearning = () => {
    const firstLessonId = topics?.[0]?.lessons?.[0]?.id;
    if (firstLessonId) {
      navigate(`/courses/${courseId}/lessons/${firstLessonId}`);
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
  if (error && !course) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: 'Courses', path: '/courses' }]} />
        <div className="text-center py-12 bg-red-50 rounded-lg">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-800 mb-2">
            {error === 'Course not found' ? 'Course Not Found' : 'Failed to Load Course'}
          </h2>
          <p className="text-red-600 mb-6">
            {error === 'Course not found'
              ? 'The course you are looking for does not exist or may have been removed.'
              : error}
          </p>
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
        {/* Course Info */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              {course.title}
            </h1>
            <p className="text-gray-600 mb-6">
              {course.description}
            </p>

            {!isEnrolled ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 mb-4">
                  You need to enroll in this course to access its content.
                </p>
                <button
                  onClick={handleEnroll}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Enroll Now
                </button>
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

        {/* Course Navigation */}
        <div className="lg:col-span-1">
          <CourseNavigation topics={topics} courseId={courseId!} />
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;
