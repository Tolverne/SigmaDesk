import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { ArrowLeft, Save, Plus, Edit, Trash2, FileText } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  estimated_minutes: number;
  display_order: number;
}

const AdminTopicForm: React.FC = () => {
  const { courseId, topicId } = useParams<{ courseId: string; topicId: string }>();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!topicId;

  useEffect(() => {
    if (topicId) {
      loadTopic();
      loadLessons();
    }
  }, [topicId]);

  const loadTopic = async () => {
    if (!topicId) return;

    try {
      setLoading(true);
      const topics = await adminService.getTopics(courseId!);
      const topic = topics.find(t => t.id === topicId);
      
      if (topic) {
        setFormData({
          title: topic.title,
          description: topic.description || '',
        });
      }
    } catch (err: any) {
      console.error('Error loading topic:', err);
      alert(`Failed to load topic: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadLessons = async () => {
    if (!topicId) return;

    try {
      const data = await adminService.getLessons(topicId);
      setLessons(data || []);
    } catch (err: any) {
      console.error('Error loading lessons:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Please enter a topic title');
      return;
    }

    if (!courseId) {
      alert('Course ID is missing');
      return;
    }

    try {
      setSaving(true);

      if (isEdit && topicId) {
        await adminService.updateTopic(topicId, formData);
        alert('Topic updated successfully');
        navigate(`/admin/courses/${courseId}`);
      } else {
        // Get next display order
        const existingTopics = await adminService.getTopics(courseId);
        const maxOrder = existingTopics.reduce((max, t) => Math.max(max, t.display_order), -1);

        await adminService.createTopic({
          ...formData,
          course_id: courseId,
          display_order: maxOrder + 1,
        });
        alert('Topic created successfully');
        navigate(`/admin/courses/${courseId}`);
      }
    } catch (err: any) {
      console.error('Error saving topic:', err);
      alert(`Failed to save topic: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      await adminService.deleteLesson(lessonId);
      setLessons(lessons.filter(l => l.id !== lessonId));
    } catch (err: any) {
      alert(`Failed to delete lesson: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-io-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate(`/admin/courses/${courseId}`)}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back to Course
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Topic' : 'Create New Topic'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEdit ? 'Update topic details and manage lessons' : 'Add a new topic to organize course content'}
        </p>
      </div>

      {/* Topic Details Form */}
      <form onSubmit={handleSubmit} className="space-y-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Topic Details</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Topic Title *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-io-primary focus:border-transparent"
                placeholder="e.g., Introduction to Algebra"
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
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-io-primary focus:border-transparent"
                placeholder="Brief overview of this topic..."
              />
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-6 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? 'Saving...' : isEdit ? 'Update Topic' : 'Create Topic'}
            </button>

            <button
              type="button"
              onClick={() => navigate(`/admin/courses/${courseId}`)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      {/* Lessons Section (only show if editing) */}
      {isEdit && topicId && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Lessons</h2>
            <button
              onClick={() => navigate(`/admin/courses/${courseId}/topics/${topicId}/lessons/new`)}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Lesson
            </button>
          </div>

          {lessons.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">No lessons yet. Add your first lesson to this topic.</p>
              <button
                onClick={() => navigate(`/admin/courses/${courseId}/topics/${topicId}/lessons/new`)}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Add First Lesson
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{lesson.title}</h3>
                    {lesson.description && (
                      <p className="text-sm text-gray-600 mt-1">{lesson.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Estimated time: {lesson.estimated_minutes} minutes
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => navigate(`/admin/courses/${courseId}/topics/${topicId}/lessons/${lesson.id}`)}
                      className="p-2 text-gray-600 hover:text-primary hover:bg-blue-50 rounded-md transition-colors"
                      title="Edit Lesson"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    
                    <button
                      onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete Lesson"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminTopicForm;