import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { ArrowLeft, Save, Eye, Code } from 'lucide-react';
import SectionCarousel from '../../components/lesson/SectionCarousel';

const AdminLessonForm: React.FC = () => {
  const { courseId, topicId, lessonId } = useParams<{ 
    courseId: string; 
    topicId: string;
    lessonId: string;
  }>();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_latex: '',
    estimated_minutes: 30,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const isEdit = !!lessonId;

  useEffect(() => {
    if (lessonId) {
      loadLesson();
    }
  }, [lessonId]);

  const loadLesson = async () => {
    if (!lessonId) return;

    try {
      setLoading(true);
      const lesson = await adminService.getLesson(lessonId);
      setFormData({
        title: lesson.title,
        description: lesson.description || '',
        content_latex: lesson.content_latex || '',
        estimated_minutes: lesson.estimated_minutes,
      });
    } catch (err: any) {
      console.error('Error loading lesson:', err);
      alert(`Failed to load lesson: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Please enter a lesson title');
      return;
    }

    if (!topicId) {
      alert('Topic ID is missing');
      return;
    }

    try {
      setSaving(true);

      if (isEdit && lessonId) {
        await adminService.updateLesson(lessonId, formData);
        alert('Lesson updated successfully');
        navigate(`/admin/courses/${courseId}/topics/${topicId}`);
      } else {
        // Get next display order
        const existingLessons = await adminService.getLessons(topicId);
        const maxOrder = existingLessons.reduce((max, l) => Math.max(max, l.display_order), -1);

        await adminService.createLesson({
          ...formData,
          topic_id: topicId,
          display_order: maxOrder + 1,
        });
        alert('Lesson created successfully');
        navigate(`/admin/courses/${courseId}/topics/${topicId}`);
      }
    } catch (err: any) {
      console.error('Error saving lesson:', err);
      alert(`Failed to save lesson: ${err.message}`);
    } finally {
      setSaving(false);
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
        onClick={() => navigate(`/admin/courses/${courseId}/topics/${topicId}`)}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back to Topic
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Lesson' : 'Create New Lesson'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEdit ? 'Update lesson content and details' : 'Add a new lesson with LaTeX content'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Lesson Details</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Lesson Title *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sigma-blue focus:border-transparent"
                placeholder="e.g., Solving Linear Equations"
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
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sigma-blue focus:border-transparent"
                placeholder="Brief overview of this lesson..."
              />
            </div>

            <div>
              <label htmlFor="estimated_minutes" className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Minutes *
              </label>
              <input
                type="number"
                id="estimated_minutes"
                value={formData.estimated_minutes}
                onChange={(e) => setFormData({ ...formData, estimated_minutes: parseInt(e.target.value) || 0 })}
                className="w-32 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sigma-blue focus:border-transparent"
                min="1"
                required
              />
            </div>
          </div>
        </div>

        {/* LaTeX Editor */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Lesson Content (LaTeX)</h2>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {showPreview ? (
                <>
                  <Code className="w-5 h-5 mr-2" />
                  Edit
                </>
              ) : (
                <>
                  <Eye className="w-5 h-5 mr-2" />
                  Preview
                </>
              )}
            </button>
          </div>

          {!showPreview ? (
            <div>
              <textarea
                id="content_latex"
                value={formData.content_latex}
                onChange={(e) => setFormData({ ...formData, content_latex: e.target.value })}
                rows={20}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sigma-blue focus:border-transparent font-mono text-sm"
                placeholder={`\\section{Introduction}
This is an example lesson.

\\workskip

\\section{Practice Problems}
\\questions
\\question Solve for x: $2x + 5 = 13$
\\parts
\\part What is the first step?
\\part What is the final answer?
\\question Graph the line $y = 2x + 1$

\\bigskip`}
              />
              <div className="mt-2 text-sm text-gray-600">
                <p className="font-semibold mb-1">LaTeX Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><code>\section{'{'}Title{'}'}</code> - Creates a new section</li>
                  <li><code>\workskip</code> - Adds a student canvas</li>
                  <li><code>\bigskip</code> - Adds a teacher example canvas</li>
                  <li><code>$...$</code> - Inline math (e.g., $x^2 + 1$)</li>
                  <li><code>\includegraphics{'{'}url{'}'}</code> - Embed an image</li>
                  <li><code>\video{'{'}url{'}'}</code> - Embed a video</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="border border-gray-300 rounded-lg p-6 bg-gray-50 min-h-[400px]">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Preview</h3>
              {formData.content_latex ? (
                <SectionCarousel 
                  lessonId="preview" 
                  latexSource={formData.content_latex} 
                />
              ) : (
                <p className="text-gray-500 text-center py-12">
                  No content to preview. Add some LaTeX content to see the preview.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center px-6 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5 mr-2" />
            {saving ? 'Saving...' : isEdit ? 'Update Lesson' : 'Create Lesson'}
          </button>

          <button
            type="button"
            onClick={() => navigate(`/admin/courses/${courseId}/topics/${topicId}`)}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminLessonForm;