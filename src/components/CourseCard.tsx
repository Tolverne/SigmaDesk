import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Course } from '../types/course.types';

interface CourseCardProps {
  course: Course;
  isEnrolled?: boolean;
  className?: string;
  lastLessonId?: string; // Optional: if tracking "continue where you left off"
}

const CourseCard: React.FC<CourseCardProps> = ({ 
  course, 
  isEnrolled, 
  className,
  lastLessonId 
}) => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const handleClick = () => {
    if (isEnrolled) {
      navigate(`/courses/${course.id}`);
    }
  };

  const handleContinueLearning = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isEnrolled) return;

    // If there's a last lesson to continue from
    if (lastLessonId) {
      if (profile?.role === 'teacher') {
        // Teachers go to class selector first
        navigate(`/courses/${course.id}/classes`);
      } else {
        // Students use the redirect route (will auto-add their class)
        navigate(`/courses/${course.id}/lessons/${lastLessonId}`);
      }
    } else {
      // No specific lesson, go to course overview
      navigate(`/courses/${course.id}`);
    }
  };

  return (
    <div 
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden ${
        isEnrolled ? 'cursor-pointer' : ''
      } ${className || ''}`}
      onClick={isEnrolled ? handleClick : undefined}
    >
      <div className="p-6">
        {/* Course Header */}
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold text-gray-800">
            {course.title}
          </h3>
          {isEnrolled && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
              Enrolled
            </span>
          )}
        </div>

        {/* Course Description */}
        <p className="text-gray-600 mb-4 line-clamp-2">
          {course.description || 'No description available'}
        </p>

        {/* Course Stats */}
        <div className="flex items-center text-sm text-gray-500 mb-4">
          <span className="mr-4">
            📚 {course.topic_count || 0} topics
          </span>
          <span>
            📝 {course.lesson_count || 0} lessons
          </span>
        </div>

        {/* Progress Bar (if enrolled) */}
        {isEnrolled && course.progress_percentage !== undefined && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progress</span>
              <span>{course.progress_percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${course.progress_percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-4">
          {isEnrolled ? (
            <button
              onClick={handleContinueLearning}
              className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Continue Learning
            </button>
          ) : (
            <div className="w-full px-4 py-2 bg-gray-100 text-gray-500 rounded-md text-center text-sm">
              Contact your administrator to enroll
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseCard;