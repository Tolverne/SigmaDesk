import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';
import { BookOpen, Users, GraduationCap, TrendingUp } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    courses: 0,
    classes: 0,
    students: 0,
    teachers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      if (!profile?.organization_id) return;

      try {
        const [coursesRes, classesRes, usersRes] = await Promise.all([
          supabase
            .from('courses')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', profile.organization_id),
          supabase
            .from('classes')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', profile.organization_id),
          supabase
            .from('user_profiles')
            .select('id, role')
            .eq('organization_id', profile.organization_id),
        ]);

        const users = usersRes.data || [];
        setStats({
          courses: coursesRes.count || 0,
          classes: classesRes.count || 0,
          students: users.filter((u: any) => u.role === 'student').length,
          teachers: users.filter((u: any) => u.role === 'teacher').length,
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [profile?.organization_id]);

  const statCards = [
    {
      name: 'Courses',
      value: stats.courses,
      icon: BookOpen,
      color: 'bg-blue-500',
      link: '/admin/courses',
    },
    {
      name: 'Classes',
      value: stats.classes,
      icon: GraduationCap,
      color: 'bg-green-500',
      link: '/admin/classes',
    },
    {
      name: 'Students',
      value: stats.students,
      icon: Users,
      color: 'bg-purple-500',
      link: '/admin/users?role=student',
    },
    {
      name: 'Teachers',
      value: stats.teachers,
      icon: TrendingUp,
      color: 'bg-orange-500',
      link: '/admin/users?role=teacher',
    },
  ];

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back, {profile?.full_name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.name}
              onClick={() => navigate(stat.link)}
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => navigate('/admin/courses/new')}
          className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-io-primary hover:bg-blue-50 transition-colors"
        >
          <BookOpen className="w-8 h-8 text-gray-400 mb-2" />
          <h3 className="font-semibold text-gray-900">Create Course</h3>
          <p className="text-sm text-gray-600 mt-1">Start building a new course</p>
        </button>

        <button
          onClick={() => navigate('/admin/classes/new')}
          className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-io-primary hover:bg-blue-50 transition-colors"
        >
          <GraduationCap className="w-8 h-8 text-gray-400 mb-2" />
          <h3 className="font-semibold text-gray-900">Create Class</h3>
          <p className="text-sm text-gray-600 mt-1">Set up a new class section</p>
        </button>

        <button
          onClick={() => navigate('/admin/users/invite')}
          className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-io-primary hover:bg-blue-50 transition-colors"
        >
          <Users className="w-8 h-8 text-gray-400 mb-2" />
          <h3 className="font-semibold text-gray-900">Invite Users</h3>
          <p className="text-sm text-gray-600 mt-1">Add teachers and students</p>
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;