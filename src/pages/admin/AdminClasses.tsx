import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';
import { Plus, GraduationCap, Edit, Trash2, Users } from 'lucide-react';

type CourseShape = { title: string } | { title: string }[];

interface Class {
  id: string;
  name: string;
  display_name: string | null;
  course_id: string;
  // Supabase may embed as a single object or an array depending on FK config — handle both
  courses: CourseShape;
  _count?: {
    enrollments: number;
  };
}

const AdminClasses: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organization_id]);

  const normalizeCourse = (c: CourseShape): { title: string } => {
    if (Array.isArray(c)) {
      return { title: String(c[0]?.title ?? '') };
    }
    return { title: String((c as any)?.title ?? '') };
  };

  const loadClasses = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);
      
      // Get classes with course info
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          display_name,
          course_id,
          courses (
            title
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (classesError) throw classesError;

      const base = (classesData || []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name ?? ''),
        display_name: row.display_name ?? null,
        course_id: String(row.course_id ?? ''),
        courses: row.courses as CourseShape,
      })) as Class[];

      // Get enrollment counts for each class
      const classesWithCounts = await Promise.all(
        base.map(async (cls) => {
          const { count, error } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id);

          if (error) {
            // Don’t fail the whole page if a single count fails
            console.warn('[AdminClasses] enrollment count failed for', cls.id, error.message);
          }

          return {
            ...cls,
            _count: { enrollments: count || 0 },
          };
        })
      );

      setClasses(classesWithCounts);
    } catch (err: any) {
      console.error('Error loading classes:', err);
      alert(`Failed to load classes: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClass = async (classId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This will remove all student enrollments in this class.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId);

      if (error) throw error;
      
      setClasses((prev) => prev.filter(c => c.id !== classId));
      alert('Class deleted successfully');
    } catch (err: any) {
      alert(`Failed to delete class: ${err.message}`);
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="text-gray-600 mt-1">Manage class sections and enrollments</p>
        </div>
        <button
          onClick={() => navigate('/admin/classes/new')}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Class
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <GraduationCap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Classes Yet</h3>
          <p className="text-gray-600 mb-6">Create class sections to organize your courses</p>
          <button
            onClick={() => navigate('/admin/classes/new')}
            className="px-6 py-3 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Create First Class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => {
            const course = normalizeCourse(cls.courses);
            return (
              <div
                key={cls.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {cls.display_name || cls.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {course.title}
                    </p>
                  </div>
                </div>

                <div className="flex items-center text-sm text-gray-600 mb-4">
                  <Users className="w-4 h-4 mr-2" />
                  <span>{cls._count?.enrollments ?? 0} students enrolled</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/admin/classes/${cls.id}`)}
                    className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Manage
                  </button>
                  
                  <button
                    onClick={() => handleDeleteClass(cls.id, cls.display_name || cls.name)}
                    className="px-3 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition-colors"
                    title="Delete Class"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminClasses;
