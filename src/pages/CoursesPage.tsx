import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { courseService } from '../services/courseService';
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

  useEffect(() => {
    console.log('📚 CoursesPage: Mounting, user:', user?.email);
    loadCourses();
    if (user) {
      loadEnrolledCourses();
    }
  }, [user]);

  const loadCourses = async () => {
    console.log('📚 CoursesPage: Loading courses...');
    try {
      const data = await courseService.getCourses();
      console.log('📚 CoursesPage: Loaded courses:', data.length);
      setCourses(data);
      setError(null);
    } catch (error) {
      console.error('📚 CoursesPage: Error loading courses:', error);
      setError('Failed to load courses. Please try again.');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const loadEnrolledCourses = async () => {
    if (!user) return;
    
    console.log('📚 CoursesPage: Loading enrolled courses...');
    try {
      const enrolled = await courseService.getEnrolledCourses(user.id);
      console.log('📚 CoursesPage: Enrolled courses:', enrolled.length);
      setEnrolledCourseIds(new Set(enrolled.map(c => c.id)));
    } catch (error) {
      console.error('📚 CoursesPage: Error loading enrolled courses:', error);
      // Don't show error for enrollment loading - not critical
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) {
      alert('Please sign in to enroll in courses');
      return;
    }

    setEnrolling(courseId);
    try {
      await courseService.enrollInCourse(courseId, user.id);
      setEnrolledCourseIds(new Set(Array.from(enrolledCourseIds).concat(courseId)));
      alert('Successfully enrolled in course!');
    } catch (error: any) {
      alert(error.message || 'Failed to enroll in course');
    } finally {
      setEnrolling(null);
    }
  };

  // Show error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12 bg-red-50 rounded-lg">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => {
              setLoading(true);
              setError(null);
              loadCourses();
            }}
            className="px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sigma-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading courses...</p>
          <p className="mt-2 text-sm text-gray-500">Please wait...</p>
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
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-500">No courses available at the moment.</p>
          <button 
            onClick={() => {
              setLoading(true);
              loadCourses();
            }}
            className="mt-4 px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700"
          >
            Refresh
          </button>
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
    </div>
  );
};

export default CoursesPage;