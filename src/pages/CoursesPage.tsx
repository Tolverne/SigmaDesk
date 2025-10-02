import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { courseService } from '../services/courseService';
import { Course } from '../types/course.types';
import CourseCard from '../components/CourseCard';
import Breadcrumb from '../components/Breadcrumb';

const CoursesPage: React.FC = () => {
  const { user, profile } = useAuth(); // Added profile here
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reloadNonce, setReloadNonce] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const load = async () => {
      if (signal.aborted) return;

      setLoading(true);
      setError(null);

      try {
        const [courseList, enrolledList] = await Promise.all([
          courseService.getCourses({ signal }),
          user ? courseService.getEnrolledCourses(user.id, { signal }) : Promise.resolve([]),
        ]);

        if (signal.aborted) return;

        setCourses(courseList || []);
        setEnrolledCourseIds(new Set((enrolledList || []).map((c: Course) => c.id)));
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('Failed to load courses:', err);
        if (!signal.aborted) {
          setError('Failed to load courses. Please try again.');
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    load();

    return () => {
      controller.abort();
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [user?.id, reloadNonce]);

  const handleRetry = () => {
    courseService.clearCache();
    setReloadNonce((n) => n + 1);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sigma-blue mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Loading Courses...
          </h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12 bg-red-50 rounded-lg">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-800 mb-4">
            Failed to Load Courses
          </h2>
          <p className="text-red-600 mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Courses' }]} />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">My Courses</h1>
        <p className="text-gray-600">
          Courses you're enrolled in through your classes
        </p>

        <div className="mt-4 flex items-center space-x-4 text-sm">
          <span className="text-gray-500">
            {courses.length} course{courses.length !== 1 ? 's' : ''} available
          </span>
          {user && (
            <span className="text-gray-500">
              {enrolledCourseIds.size} enrolled
            </span>
          )}
        </div>

        {profile?.role !== 'student' && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Students are now enrolled in courses through classes. 
              Contact your administrator to create classes and enroll students.
            </p>
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <div className="text-gray-400 text-5xl mb-4">📚</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Courses Available</h3>
          <p className="text-gray-500 mb-6">
            {user 
              ? "You're not enrolled in any courses yet. Contact your administrator to be added to a class."
              : "Sign in to see your courses."}
          </p>
          {!user && (
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              isEnrolled={enrolledCourseIds.has(course.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CoursesPage;