import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';

interface Course {
  id: string;
  title: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Enrollment {
  id: string;
  user_id: string;
  user_profiles: {
    full_name: string;
    email: string;
  };
}

const AdminClassForm: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    course_id: '',
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!classId;

  useEffect(() => {
    loadCourses();
    loadUsers();
    if (classId) {
      loadClass();
      loadEnrollments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const loadCourses = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .eq('organization_id', profile.organization_id)
        .order('title');

      if (error) throw error;
      setCourses((data || []).map((c: any) => ({ id: String(c.id), title: String(c.title ?? '') })));
    } catch (err: any) {
      console.error('Error loading courses:', err);
    }
  };

  const loadUsers = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .eq('organization_id', profile.organization_id)
        .order('full_name');

      if (error) throw error;
      
      const list = (data || []).map((u: any) => ({
        id: String(u.id),
        full_name: String(u.full_name ?? ''),
        email: String(u.email ?? ''),
        role: String(u.role ?? ''),
      })) as User[];

      setTeachers(list.filter(u => u.role === 'teacher'));
      setStudents(list.filter(u => u.role === 'student'));
    } catch (err: any) {
      console.error('Error loading users:', err);
    }
  };

  const loadClass = async () => {
    if (!classId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();

      if (error) throw error;
      
      setFormData({
        name: String(data.name ?? ''),
        display_name: String(data.display_name ?? ''),
        course_id: String(data.course_id ?? ''),
      });
    } catch (err: any) {
      console.error('Error loading class:', err);
      alert(`Failed to load class: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadEnrollments = async () => {
    if (!classId) return;

    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          user_id,
          user_profiles (
            full_name,
            email
          )
        `)
        .eq('class_id', classId);

      if (error) throw error;

      // Normalize nested profile to an object (handle array/object both)
      const normalized = (data || []).map((row: any) => {
        const up = Array.isArray(row.user_profiles)
          ? row.user_profiles[0] ?? {}
          : row.user_profiles ?? {};
        return {
          id: String(row.id),
          user_id: String(row.user_id),
          user_profiles: {
            full_name: String(up.full_name ?? ''),
            email: String(up.email ?? ''),
          },
        } as Enrollment;
      });

      setEnrollments(normalized);
    } catch (err: any) {
      console.error('Error loading enrollments:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.course_id) {
      alert('Please fill in all required fields');
      return;
    }

    if (!profile?.organization_id) {
      alert('No organization found');
      return;
    }

    try {
      setSaving(true);

      if (isEdit && classId) {
        const { error } = await supabase
          .from('classes')
          .update({
            name: formData.name,
            display_name: formData.display_name || null,
            // course_id is disabled in edit mode — do not override here
          })
          .eq('id', classId);

        if (error) throw error;
        alert('Class updated successfully');
      } else {
        const { error } = await supabase
          .from('classes')
          .insert({
            name: formData.name,
            display_name: formData.display_name || null,
            course_id: formData.course_id,
            organization_id: profile.organization_id,
          });

        if (error) throw error;
        alert('Class created successfully');
        navigate('/admin/classes');
      }
    } catch (err: any) {
      console.error('Error saving class:', err);
      alert(`Failed to save class: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEnrollStudent = async () => {
    if (!selectedStudent || !classId || !formData.course_id) return;

    try {
      const { error } = await supabase
        .from('enrollments')
        .insert({
          user_id: selectedStudent,
          course_id: formData.course_id,
          class_id: classId,
        });

      if (error) throw error;
      
      setSelectedStudent('');
      await loadEnrollments();
      alert('Student enrolled successfully');
    } catch (err: any) {
      alert(`Failed to enroll student: ${err.message}`);
    }
  };

  const handleUnenrollStudent = async (enrollmentId: string) => {
    if (!window.confirm('Are you sure you want to remove this student from the class?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId);

      if (error) throw error;
      
      setEnrollments((prev) => prev.filter(e => e.id !== enrollmentId));
      alert('Student removed successfully');
    } catch (err: any) {
      alert(`Failed to remove student: ${err.message}`);
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
        onClick={() => navigate('/admin/classes')}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back to Classes
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Class' : 'Create New Class'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEdit ? 'Update class details and manage enrollments' : 'Create a new class section for a course'}
        </p>
      </div>

      {/* Class Details Form */}
      <form onSubmit={handleSubmit} className="space-y-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Class Details</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="course_id" className="block text-sm font-medium text-gray-700 mb-2">
                Course *
              </label>
              <select
                id="course_id"
                value={formData.course_id}
                onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sigma-blue focus:border-transparent"
                required
                disabled={isEdit}
              >
                <option value="">Select a course...</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
              {isEdit && (
                <p className="text-xs text-gray-500 mt-1">
                  Course cannot be changed after class creation
                </p>
              )}
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Class Code/ID *
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sigma-blue focus:border-transparent"
                placeholder="e.g., MATH10-A"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Internal identifier for the class
              </p>
            </div>

            <div>
              <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              <input
                type="text"
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sigma-blue focus:border-transparent"
                placeholder="e.g., Period 1 - Morning Session"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional friendly name shown to students
              </p>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-6 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? 'Saving...' : isEdit ? 'Update Class' : 'Create Class'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin/classes')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      {/* Student Enrollments (only show if editing) */}
      {isEdit && classId && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Enrollments</h2>
          
          {/* Add Student */}
          <div className="flex gap-2 mb-6">
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sigma-blue focus:border-transparent"
            >
              <option value="">Select a student to enroll...</option>
              {students
                .filter(s => !enrollments.some(e => e.user_id === s.id))
                .map(student => (
                  <option key={student.id} value={student.id}>
                    {student.full_name} ({student.email})
                  </option>
                ))}
            </select>
            <button
              onClick={handleEnrollStudent}
              disabled={!selectedStudent}
              className="flex items-center px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5 mr-2" />
              Enroll
            </button>
          </div>

          {/* Enrolled Students List */}
          {enrollments.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No students enrolled yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {enrollment.user_profiles.full_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {enrollment.user_profiles.email}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnenrollStudent(enrollment.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Remove from class"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminClassForm;
