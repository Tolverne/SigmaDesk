import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';

const LessonRedirect: React.FC = () => {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    const { signal } = controller;

    // Wait for auth to be ready before redirecting
    if (!authLoading && user && profile) {
      redirectToClassAwareUrl(signal);
    }

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessonId, user?.id, profile?.role, authLoading]);

  const redirectToClassAwareUrl = async (signal?: AbortSignal) => {
    if (!user?.id || !lessonId || !profile) {
      if (mountedRef.current) {
        setError('Missing required information');
        setRedirecting(false);
      }
      return;
    }

    if (signal?.aborted) return;

    try {
      setRedirecting(true);
      setError(null);

      // Teachers should go through class selector
      if (profile.role === 'teacher' || profile.role === 'admin' || profile.role === 'super_admin') {
        // Get course_id from lesson if not in URL
        let resolvedCourseId = courseId;
        
        if (!resolvedCourseId) {
          const { data, error: lessonError } = await supabase
            .from('lessons')
            .select('topic_id, topics(course_id)')
            .eq('id', lessonId)
            .single();

          if (signal?.aborted || !mountedRef.current) return;

          if (lessonError) {
            throw new Error('Could not determine course for this lesson.');
          }

          resolvedCourseId = (data as any)?.topics?.course_id;
        }
        
        if (!resolvedCourseId) {
          if (mountedRef.current) {
            setError('Could not determine course for this lesson.');
            setRedirecting(false);
          }
          return;
        }

        // Redirect to class selector
        navigate(`/courses/${resolvedCourseId}/classes`, { replace: true });
        return;
      }

      // Students: auto-resolve their class
      const { data: classId, error: rpcError } = await supabase.rpc('get_student_class_for_lesson', {
        student_user_id: user.id,
        lesson_id_param: lessonId,
      });

      if (signal?.aborted || !mountedRef.current) return;

      if (rpcError) {
        console.error('[LessonRedirect] RPC error:', rpcError);
        throw new Error('Failed to determine your class for this lesson.');
      }

      if (!classId) {
        if (mountedRef.current) {
          setError('You are not enrolled in a class for this lesson.');
          setRedirecting(false);
        }
        return;
      }

      // Get course_id for the URL
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('topic_id, topics(course_id)')
        .eq('id', lessonId)
        .single();

      if (signal?.aborted || !mountedRef.current) return;

      if (lessonError) {
        throw new Error('Could not load lesson information.');
      }

      const resolvedCourseId = (lesson as any)?.topics?.course_id;
      
      if (!resolvedCourseId) {
        if (mountedRef.current) {
          setError('Could not determine course for this lesson.');
          setRedirecting(false);
        }
        return;
      }

      // Navigate to class-aware lesson URL
      navigate(`/courses/${resolvedCourseId}/classes/${classId}/lessons/${lessonId}`, { 
        replace: true 
      });

    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      
      console.error('[LessonRedirect] Error:', err);
      
      if (mountedRef.current) {
        const msg = err?.message || '';
        if (msg.toLowerCase().includes('jwt') || msg.toLowerCase().includes('session')) {
          setError('Your session has expired. Please sign in again.');
        } else {
          setError(err.message || 'Failed to load lesson. Please try again.');
        }
        setRedirecting(false);
      }
    }
  };

  // Still loading auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-io-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-800 mb-2">Unable to Load Lesson</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={() => navigate('/courses')}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Back to Courses
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Redirecting (normal case)
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-io-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Loading lesson...</p>
        <p className="text-sm text-gray-500 mt-2">
          {profile?.role === 'teacher' || profile?.role === 'admin' || profile?.role === 'super_admin'
            ? 'Redirecting to class selection...'
            : 'Finding your class...'}
        </p>
      </div>
    </div>
  );
};

export default LessonRedirect;