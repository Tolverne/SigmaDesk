// src/pages/admin/AdminClassForm.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';
import { ArrowLeft, Save, Plus, X, Star } from 'lucide-react';

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

// Teacher assignment from class_teachers table
interface ClassTeacher {
  id: string;
  user_id: string;
  is_primary: boolean;
  user_profiles: {
    full_name: string;
    email: string;
  };
}

// Raw enrollment row as returned by Supabase (user_profiles can be an array or object)
interface EnrollmentRow {
  id: string;
  user_id: string;
  user_profiles:
    | { full_name: string; email: string }
    | { full_name: string; email: string }[]
    | null;
}

// Normalized enrollment shape for our UI (single object)
interface Enrollment {
  id: string;
  user_id: string;
  user_profiles: {
    full_name: string;
    email: string;
  };
}

type CourseEnrollmentMap = Record<string, { class_id: string; class_name: string }>;

function firstNameFromFullName(full_name?: string): string {
  if (!full_name) return '';
  const parts = full_name.trim().split(/\s+/);
  return parts[0] || '';
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
  const [classTeachers, setClassTeachers] = useState<ClassTeacher[]>([]);
  const [courseEnrollments, setCourseEnrollments] = useState<CourseEnrollmentMap>({});
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!classId;

  useEffect(() => {
    loadCourses();
    loadUsers();
  }, [profile?.organization_id]);

  useEffect(() => {
    if (classId) {
      loadClass().then(() => {
        loadEnrollments();
        loadClassTeachers();
        loadCourseEnrollments(); // depends on formData.course_id (set by loadClass)
      });
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
      setCourses(data || []);
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
      setTeachers((data || []).filter(u => u.role === 'teacher'));
      setStudents((data || []).filter(u => u.role === 'student'));
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
        name: data.name,
        display_name: data.display_name || '',
        course_id: data.course_id,
      });
    } catch (err: any) {
      console.error('Error loading class:', err);
      alert(`Failed to load class: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load teachers assigned to this class
  const loadClassTeachers = async () => {
    if (!classId) return;

    try {
      // Step 1: get class_teachers rows for this class
      const { data: rows, error } = await supabase
        .from('class_teachers')
        .select('id, user_id, is_primary')
        .eq('class_id', classId);

      if (error) throw error;

      if (!rows || rows.length === 0) {
        setClassTeachers([]);
        return;
      }

      // Step 2: fetch profiles for those user IDs
      const ids = Array.from(new Set(rows.map((r: any) => r.user_id))).filter(Boolean) as string[];
      let profilesMap: Record<string, { full_name: string; email: string }> = {};

      if (ids.length > 0) {
        const { data: profs, error: profErr } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', ids);

        if (profErr) {
          console.warn('[AdminClassForm] teacher profiles fetch failed:', profErr.message);
        } else if (profs) {
          profilesMap = (profs as any[]).reduce((acc, p) => {
            acc[p.id] = { full_name: p.full_name || '', email: p.email || '' };
            return acc;
          }, {} as Record<string, { full_name: string; email: string }>);
        }
      }

      const normalized = (rows || []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        is_primary: r.is_primary || false,
        user_profiles: profilesMap[r.user_id] || { full_name: '', email: '' },
      }));

      setClassTeachers(normalized);
    } catch (err: any) {
      console.error('Error loading class teachers:', err);
    }
  };

  // Enrollments for THIS class (robust: normalize arrays/objects + fallback to 2-step fetch)
  const loadEnrollments = async () => {
    if (!classId) return;

    try {
      // Step 1: get enrollment rows for this class (no nested joins)
      const { data: rows, error } = await supabase
        .from('enrollments')
        .select('id, user_id')
        .eq('class_id', classId);

      if (error) throw error;

      if (!rows || rows.length === 0) {
        setEnrollments([]);
        return;
      }

      // Step 2: fetch profiles for those user IDs and merge
      const ids = Array.from(new Set(rows.map((r: any) => r.user_id))).filter(Boolean) as string[];
      let profilesMap: Record<string, { full_name: string; email: string }> = {};

      if (ids.length > 0) {
        const { data: profs, error: profErr } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', ids);

        if (profErr) {
          console.warn('[AdminClassForm] profiles fetch failed:', profErr.message);
        } else if (profs) {
          profilesMap = (profs as any[]).reduce((acc, p) => {
            acc[p.id] = { full_name: p.full_name || '', email: p.email || '' };
            return acc;
          }, {} as Record<string, { full_name: string; email: string }>);
        }
      }

      const normalized = (rows || []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        user_profiles: profilesMap[r.user_id] || { full_name: '', email: '' },
      }));

      setEnrollments(normalized);
    } catch (err: any) {
      console.error('Error loading enrollments:', err);
    }
  };

  // Enrollments for THIS COURSE across ANY class (for "move" UX)
  const loadCourseEnrollments = async () => {
    if (!formData.course_id) return;
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          user_id,
          class_id,
          classes (
            name,
            display_name
          )
        `)
        .eq('course_id', formData.course_id);

      if (error) throw error;

      const map: CourseEnrollmentMap = {};
      (data || []).forEach((row: any) => {
        const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes;
        const className = cls?.display_name || cls?.name || 'Unknown class';
        map[row.user_id] = { class_id: row.class_id, class_name: className };
      });
      setCourseEnrollments(map);
    } catch (err: any) {
      console.error('Error loading course enrollments:', err);
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
          .update(formData)
          .eq('id', classId);
        if (error) throw error;
        alert('Class updated successfully');
      } else {
        const { error } = await supabase
          .from('classes')
          .insert({
            ...formData,
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

  const handleAssignTeacher = async () => {
    if (!selectedTeacher || !classId) return;

    try {
      // Check if teacher already assigned to this class
      const { data: existing } = await supabase
        .from('class_teachers')
        .select('id')
        .eq('user_id', selectedTeacher)
        .eq('class_id', classId)
        .maybeSingle();

      if (existing?.id) {
        alert('This teacher is already assigned to this class.');
        return;
      }

      // Insert new class_teacher assignment
      const { error } = await supabase
        .from('class_teachers')
        .insert({
          user_id: selectedTeacher,
          class_id: classId,
          is_primary: classTeachers.length === 0, // First teacher is primary by default
        });

      if (error) throw error;

      setSelectedTeacher('');
      await loadClassTeachers();
      alert('Teacher assigned successfully.');
    } catch (err: any) {
      alert(`Failed to assign teacher: ${err.message}`);
    }
  };

  const handleRemoveTeacher = async (classTeacherId: string) => {
    if (!window.confirm('Are you sure you want to remove this teacher from the class?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('class_teachers')
        .delete()
        .eq('id', classTeacherId);

      if (error) throw error;

      setClassTeachers(classTeachers.filter(ct => ct.id !== classTeacherId));
      alert('Teacher removed successfully');
    } catch (err: any) {
      alert(`Failed to remove teacher: ${err.message}`);
    }
  };

  const handleTogglePrimaryTeacher = async (classTeacherId: string, currentIsPrimary: boolean) => {
    try {
      // If setting as primary, first unset all others
      if (!currentIsPrimary) {
        await supabase
          .from('class_teachers')
          .update({ is_primary: false })
          .eq('class_id', classId);
      }

      // Toggle this teacher's primary status
      const { error } = await supabase
        .from('class_teachers')
        .update({ is_primary: !currentIsPrimary })
        .eq('id', classTeacherId);

      if (error) throw error;

      await loadClassTeachers();
    } catch (err: any) {
      alert(`Failed to update primary teacher: ${err.message}`);
    }
  };

  const handleEnrollStudent = async () => {
    if (!selectedStudent || !classId || !formData.course_id) return;

    try {
      // Check if student already enrolled in this course
      const { data: existing, error: existingErr } = await supabase
        .from('enrollments')
        .select(`
          id,
          class_id,
          classes (
            name,
            display_name
          )
        `)
        .eq('user_id', selectedStudent)
        .eq('course_id', formData.course_id)
        .maybeSingle();

      if (existingErr && (existingErr as any).code !== 'PGRST116') throw existingErr;

      if (existing?.id && existing.class_id !== classId) {
        const cls = Array.isArray(existing.classes) ? existing.classes[0] : existing.classes;
        const oldName = cls?.display_name || cls?.name || 'another class';
        const ok = window.confirm(
          `This student is already enrolled in "${oldName}" for this course.\n\nMove them to the current class?`
        );
        if (!ok) return;
      }

      // UPSERT on (user_id, course_id): insert or MOVE the student to this class
      const { error } = await supabase
        .from('enrollments')
        .upsert(
          [{ user_id: selectedStudent, course_id: formData.course_id, class_id: classId }],
          { onConflict: 'user_id,course_id' }
        );

      if (error) throw error;

      setSelectedStudent('');
      await loadEnrollments();
      await loadCourseEnrollments();
      alert(existing?.id ? 'Student moved to this class.' : 'Student enrolled successfully.');
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
      setEnrollments(enrollments.filter(e => e.id !== enrollmentId));
      await loadCourseEnrollments();
      alert('Student removed successfully');
    } catch (err: any) {
      alert(`Failed to remove student: ${err.message}`);
    }
  };

  // Build options for the student dropdown with helpful annotations
  const studentOptions = useMemo(() => {
    return students.map((s) => {
      const ce = courseEnrollments[s.id];
      const alreadyInThisClass = ce?.class_id === classId;
      const label = ce
        ? `${s.full_name} (${s.email}) — currently in ${ce.class_name}`
        : `${s.full_name} (${s.email})`;
      return { value: s.id, label, disabled: alreadyInThisClass };
    });
  }, [students, courseEnrollments, classId]);

  // Build options for teacher dropdown (exclude already assigned)
  const teacherOptions = useMemo(() => {
    const assignedIds = new Set(classTeachers.map(ct => ct.user_id));
    return teachers
      .filter(t => !assignedIds.has(t.id))
      .map(t => ({
        value: t.id,
        label: `${t.full_name} (${t.email})`,
      }));
  }, [teachers, classTeachers]);

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
                onChange={(e) => {
                  setFormData({ ...formData, course_id: e.target.value });
                  setCourseEnrollments({});
                  setSelectedStudent('');
                  if (classId) setTimeout(loadCourseEnrollments, 0);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-io-primary focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-io-primary focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-io-primary focus:border-transparent"
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
              className="flex items-center px-6 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Teacher Assignments (only show if editing) */}
      {isEdit && classId && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Teacher Assignments</h2>
            <p className="text-sm text-gray-600 mt-1">
              Teachers assigned to this class can create and edit class canvases for demonstrations.
              The primary teacher is used when auto-resolving which class canvas to display.
            </p>
          </div>

          {/* Add Teacher */}
          <div className="flex gap-2 mb-6">
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-io-primary focus:border-transparent"
            >
              <option value="">Select a teacher to assign...</option>
              {teacherOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleAssignTeacher}
              disabled={!selectedTeacher}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5 mr-2" />
              Assign
            </button>
          </div>

          {/* Assigned Teachers List */}
          {classTeachers.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No teachers assigned to this class yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Assign at least one teacher to enable class canvas functionality
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {classTeachers.map((ct) => (
                <div
                  key={ct.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleTogglePrimaryTeacher(ct.id, ct.is_primary)}
                      className={`p-1 rounded transition-colors ${
                        ct.is_primary
                          ? 'text-yellow-500 hover:text-yellow-600'
                          : 'text-gray-300 hover:text-yellow-500'
                      }`}
                      title={ct.is_primary ? 'Primary teacher' : 'Set as primary teacher'}
                    >
                      <Star className={`w-5 h-5 ${ct.is_primary ? 'fill-current' : ''}`} />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {ct.user_profiles.full_name || '—'}
                        </p>
                        {ct.is_primary && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {ct.user_profiles.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveTeacher(ct.id)}
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

      {/* Student Enrollments (only show if editing) */}
      {isEdit && classId && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Enrollments</h2>

          {/* Add Student */}
          <div className="flex gap-2 mb-6">
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-io-primary focus:border-transparent"
            >
              <option value="">Select a student to enroll...</option>
              {studentOptions.map(opt => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleEnrollStudent}
              disabled={!selectedStudent || !formData.course_id}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5 mr-2" />
              Enroll
            </button>
          </div>

          {/* Enrolled Students List */}
          {enrollments.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No students enrolled in this class yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {enrollments.map((enrollment) => {
                const first = firstNameFromFullName(enrollment.user_profiles.full_name);
                return (
                  <div
                    key={enrollment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {first || enrollment.user_profiles.full_name || '—'}
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
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminClassForm;