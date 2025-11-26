import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { courseService } from '../services/courseService';
import { supabase } from '../utils/supabase';
import { Course, Topic } from '../types/course.types';
import CourseNavigation from '../components/CourseNavigation';
import Breadcrumb, { BreadcrumbItem } from '../components/Breadcrumb';

interface ClassWithStats {
  id: string;
  name: string;
  display_name: string | null;
  student_count: number;
  is_primary: boolean;
}

const CourseDetailPage: React.FC = () => {
  const { courseId, classId } = useParams<{ courseId: string; classId?: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Class selection state (for teachers)
  const [classes, setClasses] = useState<ClassWithStats[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [className, setClassName] = useState<string | null>(null);

  const mountedRef = useRef(true);

  // Load course details
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

  // Load class name if classId exists
  useEffect(() => {
    if (!classId) {
      setClassName(null);
      return;
    }

    const loadClassName = async () => {
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('name, display_name')
          .eq('id', classId)
          .single();

        if (error) throw error;
        setClassName(data.display_name || data.name);
      } catch (err) {
        console.error('Error loading class name:', err);
      }
    };

    loadClassName();
  }, [classId]);

  // Load teacher's classes for this course (if teacher without classId)
  useEffect(() => {
    if (profile?.role !== 'teacher' || classId || !courseId || !user?.id) {
      return;
    }

    const loadClasses = async () => {
      setClassesLoading(true);
      try {
        // Get all classes for this course
        const { data: courseClasses, error: classError } = await supabase
          .from('classes')
          .select('id, name, display_name')
          .eq('course_id', courseId);

        if (classError) throw classError;

        if (!courseClasses || courseClasses.length === 0) {
          setClasses([]);
          return;
        }

        const classIds = courseClasses.map(c => c.id);

        // Check which ones this teacher is assigned to
        const { data: teacherAssignments, error: assignError } = await supabase
          .from('class_teachers')
          .select('class_id, is_primary')
          .eq('user_id', user.id)
          .in('class_id', classIds);

        if (assignError) throw assignError;

        const assignedClassIds = new Set(
          (teacherAssignments || []).map((a: any) => a.class_id)
        );

        const assignedClasses = courseClasses.filter(c => assignedClassIds.has(c.id));

        // Get student counts
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('class_id')
          .in('class_id', assignedClasses.map(c => c.id));

        const countMap = (enrollments || []).reduce((acc: Record<string, number>, e: any) => {
          acc[e.class_id] = (acc[e.class_id] || 0) + 1;
          return acc;
        }, {});

        const primaryMap = (teacherAssignments || []).reduce((acc: Record<string, boolean>, a: any) => {
          acc[a.class_id] = a.is_primary || false;
          return acc;
        }, {});

        const classList = assignedClasses.map((c: any) => ({
          id: c.id,
          name: c.name,
          display_name: c.display_name,
          student_count: countMap[c.id] || 0,
          is_primary: primaryMap[c.id] || false,
        }));

        setClasses(classList);
      } catch (err) {
        console.error('Failed to load classes:', err);
      } finally {
        setClassesLoading(false);
      }
    };

    loadClasses();
  }, [courseId, user?.id, profile?.role, classId]);

  const handleSelectClass = (selectedClassId: string) => {
    // Navigate to class-aware course URL
    navigate(`/courses/${courseId}/classes/${selectedClassId}`);
  };

  const startLearning = () => {
    const firstLessonId = topics?.[0]?.lessons?.[0]?.id;
    if (!firstLessonId) return;

    if (classId) {
      // Already have class context, go directly to lesson
      navigate(`/courses/${courseId}/classes/${classId}/lessons/${firstLessonId}`);
    } else if (profile?.role === 'teacher') {
      // Teacher needs to select class first (shouldn't happen with new flow)
      alert('Please select a class first');
    } else {
      // Student - use redirect route
      navigate(`/courses/${courseId}/lessons/${firstLessonId}`);
    }
  };

  // Build breadcrumbs
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Courses', path: '/courses' },
    { label: course?.title || 'Course' }
  ];

  // Add class breadcrumb if present
  if (classId && className) {
    breadcrumbItems[1].path = `/courses/${courseId}`;
    breadcrumbItems.push({ label: className });
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-io-primary"></div>
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
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
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

  // Teacher without class selected - show class selector
  if (profile?.role === 'teacher' && !classId) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={breadcrumbItems} />

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{course.title}</h1>
          <p className="text-gray-600 mb-4">{course.description}</p>
          <p className="text-primary font-medium">Select a class to continue</p>
        </div>

        {classesLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-io-primary"></div>
          </div>
        ) : classes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-gray-400 text-5xl mb-4">📚</div>
            <h2 className="text-xl font-bold mb-2">No Classes Assigned</h2>
            <p className="text-gray-600">
              You are not assigned to any classes for this course. Contact your administrator to be assigned to a class.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => handleSelectClass(cls.id)}
                className="text-left p-6 bg-white rounded-lg shadow hover:shadow-lg hover:border-io-primary border-2 border-transparent transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-xl font-semibold text-gray-800">
                    {cls.display_name || cls.name}
                  </h3>
                  {cls.is_primary && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Primary
                    </span>
                  )}
                </div>
                {cls.display_name && (
                  <p className="text-sm text-gray-500 mb-3">{cls.name}</p>
                )}
                <p className="text-gray-600">
                  {cls.student_count} {cls.student_count === 1 ? 'student' : 'students'}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Normal course view (with class context for teachers, or for students)
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb items={breadcrumbItems} />

      {classId && className && profile?.role === 'teacher' && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex justify-between items-center">
          <p className="text-sm text-blue-800">
            Teaching: <span className="font-semibold">{className}</span>
          </p>
          <button
            onClick={() => navigate(`/courses/${courseId}`)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Switch Class
          </button>
        </div>
      )}

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
                  className="px-6 py-2 bg-primary text-white rounded-md hover:bg-blue-700"
                >
                  Start Learning
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <CourseNavigation 
            topics={topics} 
            courseId={courseId!}
            classId={classId} 
          />
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;