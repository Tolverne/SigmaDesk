import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { adminService } from '../../services/adminService';
import { ArrowLeft, Save, Plus, Edit, Trash2, Book } from 'lucide-react';

interface Topic {
  id: string;
  title: string;
  description: string | null;
  display_order: number;
  lessons?: { count: number }[];
}

const AdminCourseForm: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    is_published: false,
  });
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!courseId;

  useEffect(() => {
    if (courseId) {
      loadCourse();
      loadTopics();
    }
  }, [courseId]);

  const loadCourse = async () => {
    if (!courseId) return;

    try {
      setLoading(true);
      const course = await adminService.getCourse(courseId);
      setFormData({
        title: course.title,
        description: course.description || '',
        is_published: course.is_published,
      });
    } catch (err: any) {
      console.error('Error loading course:', err);
      alert(`Failed to load course: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTopics = async () => {
    if (!courseId) return;

    try {
      const data = await adminService.getTopics(courseId);
      setTopics(data || []);
    } catch (err: any) {
      console.error('Error loading topics:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Please enter a course title');
      return;
    }

    if (!profile?.organization_id) {
      alert('No organization found');
      return;
    }

    try {
      setSaving(true);

      if (isEdit && courseId) {
        await adminService.updateCourse(courseId, formData);
        alert('Course updated successfully');
      } else {
        const newCourse = await adminService.createCourse({
          ...formData,
          organization_id: profile.organization_id,
        });
        alert('Course created successfully');
        navigate(`/admin/courses/${newCourse.id}`);
      }
    } catch (err: any) {
      console.error('Error saving course:', err);
      alert(`Failed to save course: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTopic = async (topicId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This will delete all lessons in this topic.`)) {
      return;
    }

    try {
      await adminService.deleteTopic(topicId);
      setTopics(topics.filter(t => t.id !== topicId));
    } catch (err: any) {
      alert(`Failed to delete topic: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sigma-blue"></div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate('/admin/courses')}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back to Courses
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Course' : 'Create New Course'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEdit ? 'Update course details and manage topics' : 'Add a new course to your organization'}
        </p>
      </div>

      {/* Course Details Form */}
      <form onSubmit={handleSubmit} className="space-y-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Course Details</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Course Title *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sigma-blue focus:border-transparent"
                placeholder="e.g., Mathematics 10"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sigma-blue focus:border-transparent"
                placeholder="Describe what students will learn in this course..."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_published"
                checked={formData.is_published}
                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                className="w-4 h-4 text-sigma-blue border-gray-300 rounded focus:ring-sigma-blue"
              />
              <label htmlFor="is_published" className="ml-2 text-sm text-gray-700">
                Publish course (make it visible to students)
              </label>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-6 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? 'Saving...' : isEdit ? 'Update Course' : 'Create Course'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin/courses')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      {/* Topics Section (only show if editing) */}
      {isEdit && courseId && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Topics</h2>
            <button
              onClick={() => navigate(`/admin/courses/${courseId}/topics/new`)}
              className="flex items-center px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Topic
            </button>
          </div>

          {topics.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Book className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">No topics yet. Add your first topic to start building the course.</p>
              <button
                onClick={() => navigate(`/admin/courses/${courseId}/topics/new`)}
                className="px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Add First Topic
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {topics.map((topic) => {
                const lessonCount = topic.lessons?.[0]?.count || 0;
                
                return (
                  <div
                    key={topic.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{topic.title}</h3>
                      {topic.description && (
                        <p className="text-sm text-gray-600 mt-1">{topic.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {lessonCount} lesson{lessonCount !== 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => navigate(`/admin/courses/${courseId}/topics/${topic.id}`)}
                        className="p-2 text-gray-600 hover:text-sigma-blue hover:bg-blue-50 rounded-md transition-colors"
                        title="Edit Topic"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      
                      <button
                        onClick={() => handleDeleteTopic(topic.id, topic.title)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete Topic"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminCourseForm;