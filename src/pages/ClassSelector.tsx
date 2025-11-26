import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import Breadcrumb from '../components/Breadcrumb';
import { GraduationCap, Users, Star, ChevronRight } from 'lucide-react';

interface ClassWithStats {
  id: string;
  name: string;
  display_name: string | null;
  student_count: number;
  is_primary: boolean;
}

interface ClassTeacherRow {
  is_primary: boolean;
  classes: {
    id: string;
    name: string;
    display_name: string | null;
    course_id: string;
  } | null;
}

const ClassSelector: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  
  const [classes, setClasses] = useState<ClassWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseName, setCourseName] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    const { signal } = controller;

    loadClasses();

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, user?.id]);

  const loadClasses = async () => {
  if (!courseId || !user?.id) return;
  
  try {
    setLoading(true);
    
    // Get course name
    const { data: course } = await supabase
      .from('courses')
      .select('title')
      .eq('id', courseId)
      .single();
    
    if (course) setCourseName(course.title);

    // Get teacher's classes for this course
    // First, get all classes for this course
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

    // Filter to only classes this teacher is assigned to
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

    // Build final list with counts and primary flag
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
    setLoading(false);
  }
};

const handleSelectClass = async (classId: string) => {
  try {
    // First, get topics for this course ordered correctly
    const { data: topics, error: topicError } = await supabase
      .from('topics')
      .select('id')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true })
      .limit(1);

    if (topicError) throw topicError;

    if (!topics || topics.length === 0) {
      alert('No topics found in this course');
      return;
    }

    // Then get the first lesson from the first topic
    const { data: firstLesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id')
      .eq('topic_id', topics[0].id)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (lessonError) throw lessonError;

    if (firstLesson) {
      // Navigate to first lesson with class context
      navigate(`/courses/${courseId}/classes/${classId}/lessons/${firstLesson.id}`);
    } else {
      alert('No lessons found in this course');
    }
  } catch (err) {
    console.error('Error finding first lesson:', err);
    alert('Failed to load lesson');
  }
};

  const handleRetry = () => {
    loadClasses();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={[
          { label: 'Courses', path: '/courses' },
          { label: 'Classes' },
        ]} />
        
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-io-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading classes...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={[
          { label: 'Courses', path: '/courses' },
          { label: 'Classes' },
        ]} />
        
        <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-800 mb-4">
            Failed to Load Classes
          </h2>
          <p className="text-red-600 mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/courses')}
              className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Back to Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={[
          { label: 'Courses', path: '/courses' },
          { label: courseName || 'Course', path: `/courses/${courseId}` },
          { label: 'Classes' },
        ]} />
        
        <div className="text-center py-12 bg-yellow-50 rounded-lg border border-yellow-200">
          <GraduationCap className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-yellow-900 mb-4">
            No Classes Assigned
          </h2>
          <p className="text-yellow-800 mb-2">
            You are not assigned to any classes for <strong>{courseName || 'this course'}</strong>.
          </p>
          <p className="text-yellow-700 mb-6">
            Contact your administrator to be assigned to a class for this course.
          </p>
          <button
            onClick={() => navigate('/courses')}
            className="px-6 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb items={[
        { label: 'Courses', path: '/courses' },
        { label: courseName || 'Course', path: `/courses/${courseId}` },
        { label: 'Select Class' },
      ]} />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">{courseName}</h1>
        <p className="text-gray-600">
          Select a class to view lessons and manage student work
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((cls) => (
          <button
            key={cls.id}
            onClick={() => handleSelectClass(cls.id)}
            className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-io-primary hover:shadow-lg transition-all text-left group focus:outline-none focus:ring-2 focus:ring-io-primary focus:ring-offset-2"
            aria-label={`Select ${cls.display_name || cls.name}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  <h3 className="text-xl font-semibold text-gray-900 group-hover:text-primary transition-colors">
                    {cls.display_name || cls.name}
                  </h3>
                </div>
                {cls.display_name && (
                  <p className="text-sm text-gray-500 ml-7">{cls.name}</p>
                )}
              </div>
              {cls.is_primary && (
                <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-medium">
                  <Star className="w-3 h-3 fill-current" />
                  Primary
                </span>
              )}
            </div>
            
            <div className="flex items-center text-gray-600 mb-4 ml-7">
              <Users className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">
                {cls.student_count} {cls.student_count === 1 ? 'student' : 'students'}
              </span>
            </div>
            
            <div className="flex items-center justify-end text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              <span>View class</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </button>
        ))}
      </div>

      {classes.length === 1 && (
        <p className="text-center text-sm text-gray-500 mt-6">
          You have 1 class for this course
        </p>
      )}
    </div>
  );
};

export default ClassSelector;