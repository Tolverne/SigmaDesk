import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Circle, CheckCircle } from 'lucide-react';
import { Topic, Lesson } from '../types/course.types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface CourseNavigationProps {
  topics: Topic[];
  currentLessonId?: string;
  courseId: string;
  classId?: string; // Optional: if viewing from a class context
}

const CourseNavigation: React.FC<CourseNavigationProps> = ({ 
  topics, 
  currentLessonId,
  courseId,
  classId 
}) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const toggleTopic = (topicId: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  const navigateToLesson = (lessonId: string) => {
    // If classId is provided (teacher viewing from class page), use class-aware URL
    if (classId) {
      navigate(`/courses/${courseId}/classes/${classId}/lessons/${lessonId}`);
    } 
    // Teachers without classId should go to class selector
    else if (profile?.role === 'teacher') {
      navigate(`/courses/${courseId}/classes`);
    } 
    // Students use the redirect route (auto-adds their class)
    else {
      navigate(`/courses/${courseId}/lessons/${lessonId}`);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Course Content</h2>
      <div className="space-y-2">
        {topics.map((topic) => (
          <div key={topic.id}>
            <button
              onClick={() => toggleTopic(topic.id)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center">
                {expandedTopics.has(topic.id) ? (
                  <ChevronDown className="w-4 h-4 mr-2 text-gray-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-2 text-gray-600" />
                )}
                <span className="font-medium text-gray-800">{topic.title}</span>
              </div>
              <span className="text-sm text-gray-500">
                {topic.completed_lesson_count || 0}/{topic.lesson_count || 0}
              </span>
            </button>

            {expandedTopics.has(topic.id) && topic.lessons && (
              <div className="ml-6 mt-2 space-y-1">
                {topic.lessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    onClick={() => navigateToLesson(lesson.id)}
                    className={`w-full flex items-center p-2 rounded-md transition-colors ${
                      currentLessonId === lesson.id
                        ? 'bg-primary text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {lesson.is_completed ? (
                      <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                    ) : (
                      <Circle className="w-4 h-4 mr-2" />
                    )}
                    <span className="text-sm text-left flex-1">{lesson.title}</span>
                    <span className="text-xs opacity-75">
                      {lesson.estimated_minutes} min
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CourseNavigation;