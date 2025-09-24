import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { courseService } from '../services/courseService';
import { checkSupabaseHealth, resetSupabaseConnection } from '../utils/supabase';
import { Course } from '../types/course.types';
import CourseCard from '../components/CourseCard';
import Breadcrumb from '../components/Breadcrumb';

const CoursesPage: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Use refs to prevent multiple simultaneous requests
  const loadingCourses = useRef(false);
  const loadingEnrollments = useRef(false);
  
  const maxRetries = 3;

  useEffect(() => {
    console.log('📚 CoursesPage: Mounting, user:', user?.email);
    loadData();
    
    // Cleanup function
    return () => {
      loadingCourses.current = false;
      loadingEnrollments.current = false;
    };
  }, [user]); // Only depend on user

  const loadData = useCallback(async () => {
    if (loadingCourses.current) {
      console.log('📚 CoursesPage: Already loading courses, skipping...');
      return;
    }
    
    console.log('📚 CoursesPage: Starting data load...');
    setLoading(true);
    setError(null);
    setConnectionIssue(false);
    
    try {
      // Load courses and enrollments in parallel
      await Promise.all([
        loadCourses(),
        user ? loadEnrolledCourses() : Promise.resolve()
      ]);
      
      setRetryCount(0); // Reset retry count on success
      
    } catch (error) {
      console.error('📚 CoursesPage: Data load failed:', error);
      handleLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadCourses = async () => {
    if (loadingCourses.current) return;
    
    loadingCourses.current = true;
    try {
      console.log('📚 CoursesPage: Loading courses...');
      const data = await courseService.getCourses();
      console.log('📚 CoursesPage: Loaded courses:', data.length);
      setCourses(data);
      setError(null);
    } catch (error) {
      console.error('📚 CoursesPage: Error loading courses:', error);
      throw error; // Re-throw to handle in loadData
    } finally {
      loadingCourses.current = false;
    }
  };

  const loadEnrolledCourses = async () => {
    if (!user || loadingEnrollments.current) return;
    
    loadingEnrollments.current = true;
    try {
      console.log('📚 CoursesPage: Loading enrolled courses...');
      const enrolled = await courseService.getEnrolledCourses(user.id);
      console.log('📚 CoursesPage: Enrolled courses:', enrolled.length);
      setEnrolledCourseIds(new Set(enrolled.map(c => c.id)));
    } catch (error) {
      console.error('📚 CoursesPage: Error loading enrolled courses:', error);
      // Don't throw - enrollment loading is not critical
    } finally {
      loadingEnrollments.current = false;
    }
  };

  const handleLoadError = async (error: any) => {
    const isConnectionError = 
      error?.message?.includes('timeout') ||
      error?.message?.includes('network') ||
      error?.message?.includes('connection') ||
      error?.message?.includes('fetch');
    
    if (isConnectionError) {
      console.log('🔌 Detected connection issue');
      setConnectionIssue(true);
      
      // Check Supabase health
      const isHealthy = await checkSupabaseHealth();
      if (!isHealthy && retryCount < maxRetries) {
        console.log(`🔄 Connection unhealthy, attempting recovery (${retryCount + 1}/${maxRetries})`);
        setRetryCount(prev => prev + 1);
        
        // Try to reset connection
        try {
          await resetSupabaseConnection();
          setTimeout(() => loadData(), 2000); // Retry after 2 seconds
          return;
        } catch (resetError) {
          console.error('❌ Failed to reset connection:', resetError);
        }
      }
    }
    
    // Set appropriate error message
    let errorMessage = 'Failed to load courses. Please try again.';
    
    if (isConnectionError) {
      errorMessage = 'Connection issue detected. Please check your internet connection and try again.';
    } else if (error?.message?.includes('JWT') || error?.message?.includes('Session')) {
      errorMessage = 'Your session has expired. Please sign in again.';
    } else if (error?.message?.includes('Unauthorized')) {
      errorMessage = 'Access denied. Please sign in and try again.';
    }
    
    setError(errorMessage);
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) {
      alert('Please sign in to enroll in courses');
      return;
    }

    if (enrolling) {
      console.log('⚠️ Already enrolling, preventing duplicate request');
      return;
    }

    setEnrolling(courseId);
    try {
      await courseService.enrollInCourse(courseId, user.id);
      setEnrolledCourseIds(new Set(Array.from(enrolledCourseIds).concat(courseId)));
      
      // Show success message
      const courseTitle = courses.find(c => c.id === courseId)?.title || 'course';
      alert(`Successfully enrolled in ${courseTitle}!`);
      
    } catch (error: any) {
      console.error('❌ Enrollment failed:', error);
      
      let errorMessage = error.message || 'Failed to enroll in course';
      if (error.message?.includes('JWT') || error.message?.includes('Session')) {
        errorMessage = 'Your session has expired. Please sign in again.';
      }
      
      alert(errorMessage);
    } finally {
      setEnrolling(null);
    }
  };

  const handleRetry = async () => {
    console.log('🔄 User requested retry');
    setRetryCount(0); // Reset retry count
    courseService.clearCache(); // Clear any cached requests
    await loadData();
  };

  const handleConnectionReset = async () => {
    console.log('🔧 User requested connection reset');
    setLoading(true);
    setError(null);
    
    try {
      await resetSupabaseConnection();
      courseService.clearCache();
      setTimeout(() => loadData(), 1000);
    } catch (error) {
      console.error('❌ Connection reset failed:', error);
      setError('Failed to reset connection. Please refresh the page.');
      setLoading(false);
    }
  };

  // Show connection error state
  if (connectionIssue && error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-yellow-600 text-5xl mb-4">🔌</div>
          <h2 className="text-xl font-semibold text-yellow-800 mb-4">
            Connection Issue Detected
          </h2>
          <p className="text-yellow-700 mb-6 max-w-md mx-auto">
            {error}
          </p>
          
          <div className="space-y-3 max-w-sm mx-auto">
            <button 
              onClick={handleRetry}
              className="w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
            >
              🔄 Retry Loading ({retryCount}/{maxRetries})
            </button>
            
            <button 
              onClick={handleConnectionReset}
              className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
            >
              🔧 Reset Connection
            </button>
            
            <button 
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              🔄 Refresh Page
            </button>
          </div>
          
          <details className="mt-6 text-left max-w-md mx-auto">
            <summary className="cursor-pointer text-yellow-700 font-medium">
              Technical Details
            </summary>
            <div className="mt-2 p-3 bg-yellow-100 rounded text-sm text-yellow-800">
              <p><strong>Retry Count:</strong> {retryCount}/{maxRetries}</p>
              <p><strong>User:</strong> {user?.email || 'Not signed in'}</p>
              <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
              <p><strong>Error:</strong> {error}</p>
            </div>
          </details>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !connectionIssue) {
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
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sigma-blue mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Loading Courses...
          </h3>
          <p className="text-gray-600">
            {retryCount > 0 ? `Retry attempt ${retryCount}/${maxRetries}` : 'Please wait...'}
          </p>
          
          {/* Show cancel button after 10 seconds */}
          <div className="mt-4">
            <button
              onClick={() => {
                setLoading(false);
                setError('Loading cancelled by user');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Cancel Loading
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
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Available Courses</h1>
        <p className="text-gray-600">
          Browse and enroll in courses to start your learning journey
        </p>
        
        {/* Status indicators */}
        <div className="mt-4 flex items-center space-x-4 text-sm">
          <span className="text-gray-500">
            📚 {courses.length} course{courses.length !== 1 ? 's' : ''} available
          </span>
          {user && (
            <span className="text-gray-500">
              ✅ {enrolledCourseIds.size} enrolled
            </span>
          )}
          {retryCount > 0 && (
            <span className="text-yellow-600 bg-yellow-100 px-2 py-1 rounded text-xs">
              Recovered from connection issue
            </span>
          )}
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <div className="text-gray-400 text-5xl mb-4">📚</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Courses Available</h3>
          <p className="text-gray-500 mb-6">There are no published courses at the moment.</p>
          <div className="space-x-4">
            <button 
              onClick={handleRetry}
              className="px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              🔄 Refresh
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              🏠 Go Home
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              isEnrolled={enrolledCourseIds.has(course.id)}
              onEnroll={() => handleEnroll(course.id)}
            />
          ))}
        </div>
      )}
      
      {/* Debug info for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg text-xs text-gray-600">
          <strong>Debug Info:</strong>
          <div>Courses loaded: {courses.length}</div>
          <div>Enrolled: {enrolledCourseIds.size}</div>
          <div>Retry count: {retryCount}</div>
          <div>Loading refs: courses={String(loadingCourses.current)}, enrollments={String(loadingEnrollments.current)}</div>
        </div>
      )}
    </div>
  );
};

export default CoursesPage;