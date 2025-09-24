import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (courseId) {
      loadCourseData();
    }
  }, [courseId, user]);

  const loadCourseData = async () => {
    if (!courseId) return;
    
    try {
      setLoading(true);
      
      // Load course details
      const courseData = await courseService.getCourseDetails(courseId);
      setCourse(courseData);
      setTopics(courseData.topics || []);
      
      // Check enrollment
      if (user) {
        const enrolled = await courseService.checkEnrollment(courseId, user.id);
        setIsEnrolled(enrolled);
      }
    } catch (error) {
      console.error('Error loading course:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!user || !courseId) {
      alert('Please sign in to enroll');
      navigate('/login');
      return;
    }

    try {
      await courseService.enrollInCourse(courseId, user.id);
      setIsEnrolled(true);
      alert('Successfully enrolled!');
    } catch (error: any) {
      alert(error.message || 'Failed to enroll');
    }
  };

  const startLearning = () => {
    if (topics.length > 0 && topics[0].lessons && topics[0].lessons.length > 0) {
      navigate(`/courses/${courseId}/lessons/${topics[0].lessons[0].id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sigma-blue"></div>
      </div>
    );
  }

  if (!course) {
    return <div>Course not found</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb items={[
        { label: 'Courses', path: '/courses' },
        { label: course.title }
      ]} />

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
          <CourseNavigation
            topics={topics}
            courseId={courseId!}
          />
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;