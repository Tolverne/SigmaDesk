import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Course } from '../types/course.types';

interface CourseCardProps {
  course: Course;
  isEnrolled?: boolean;
  onEnroll?: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, isEnrolled, onEnroll }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (isEnrolled) {
      navigate(`/courses/${course.id}`);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden">
      <div 
        className="p-6"
        onClick={handleClick}
      >
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
                className="bg-sigma-blue h-2 rounded-full transition-all"
                style={{ width: `${course.progress_percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-4">
          {isEnrolled ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/courses/${course.id}`);
              }}
              className="w-full px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Continue Learning
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEnroll?.();
              }}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Enroll in Course
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseCard;