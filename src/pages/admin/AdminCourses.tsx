import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { adminService } from '../../services/adminService';
import { Plus, BookOpen, Edit, Trash2, Eye, EyeOff } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  display_order: number;
  topics?: { count: number }[];
}

const AdminCourses: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
  }, [profile?.organization_id]);

  const loadCourses = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getCourses(profile.organization_id);
      setCourses(data || []);
    } catch (err: any) {
      console.error('Error loading courses:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (courseId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This will delete all topics and lessons within this course.`)) {
      return;
    }

    try {
      await adminService.deleteCourse(courseId);
      setCourses(courses.filter(c => c.id !== courseId));
    } catch (err: any) {
      alert(`Failed to delete course: ${err.message}`);
    }
  };

  const togglePublished = async (course: Course) => {
    try {
      await adminService.updateCourse(course.id, {
        is_published: !course.is_published,
      });
      setCourses(courses.map(c => 
        c.id === course.id ? { ...c, is_published: !c.is_published } : c
      ));
    } catch (err: any) {
      alert(`Failed to update course: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sigma-blue"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Courses</h2>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-gray-600 mt-1">Manage your organization's courses</p>
        </div>
        <button
          onClick={() => navigate('/admin/courses/new')}
          className="flex items-center px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Courses Yet</h3>
          <p className="text-gray-600 mb-6">Get started by creating your first course</p>
          <button
            onClick={() => navigate('/admin/courses/new')}
            className="px-6 py-3 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Create Course
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => {
            const topicCount = course.topics?.[0]?.count || 0;
            
            return (
              <div
                key={course.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {course.title}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        course.is_published
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {course.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    
                    {course.description && (
                      <p className="text-gray-600 text-sm mb-3">{course.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{topicCount} topic{topicCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => togglePublished(course)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                      title={course.is_published ? 'Unpublish' : 'Publish'}
                    >
                      {course.is_published ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => navigate(`/admin/courses/${course.id}`)}
                      className="p-2 text-gray-600 hover:text-sigma-blue hover:bg-blue-50 rounded-md transition-colors"
                      title="Edit Course"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    
                    <button
                      onClick={() => handleDelete(course.id, course.title)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete Course"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminCourses;