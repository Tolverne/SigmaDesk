import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';
import { Plus, Users, Search } from 'lucide-react';

type Role = 'student' | 'teacher' | 'admin' | 'super_admin';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: Role | null;
  is_active: boolean | null;
  created_at: string;
}

const AdminUsers: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(searchParams.get('role') || 'all');

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organization_id]);

  const loadUsers = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, is_active, created_at')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers((data || []) as UserRow[]);
    } catch (err: any) {
      console.error('Error loading users:', err);
      alert(`Failed to load users: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to remove ${email} from your organization?`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);
      if (error) throw error;

      setUsers(prev => prev.filter(u => u.id !== userId));
      alert('User removed successfully');
    } catch (err: any) {
      alert(`Failed to remove user: ${err.message}`);
    }
  };

  const updateUserRole = async (userId: string, nextRole: Role) => {
    try {
      setSavingId(userId);
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: nextRole } : u)));
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: nextRole })
        .eq('id', userId);
      if (error) throw error;
    } catch (err: any) {
      alert(`Failed to update role: ${err.message}`);
      // reload to recover
      loadUsers();
    } finally {
      setSavingId(null);
    }
  };

  const updateUserActive = async (userId: string, nextActive: boolean) => {
    try {
      setSavingId(userId);
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, is_active: nextActive } : u)));
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: nextActive })
        .eq('id', userId);
      if (error) throw error;
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
      loadUsers();
    } finally {
      setSavingId(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const role = u.role === 'super_admin' ? 'admin' : (u.role || 'student'); // group super_admin under admin
    const matchesRole = roleFilter === 'all' || role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleBadgeColor = (role?: Role | null) => {
    const r = role === 'super_admin' ? 'admin' : role;
    switch (r) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'teacher':
        return 'bg-green-100 text-green-800';
      case 'student':
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const roleStats = {
    all: users.length,
    student: users.filter(u => u.role === 'student').length,
    teacher: users.filter(u => u.role === 'teacher').length,
    admin: users.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
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
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600 mt-1">Manage teachers and students in your organization</p>
        </div>
        <button
          onClick={() => navigate('/admin/users/invite')}
          className="flex items-center px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Invite User
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'All Users', value: roleStats.all, filter: 'all' },
          { label: 'Students', value: roleStats.student, filter: 'student' },
          { label: 'Teachers', value: roleStats.teacher, filter: 'teacher' },
          { label: 'Admins', value: roleStats.admin, filter: 'admin' },
        ].map((stat) => (
          <button
            key={stat.filter}
            onClick={() => setRoleFilter(stat.filter)}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              roleFilter === stat.filter
                ? 'border-sigma-blue bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </button>
        ))}
      </div>

      {/* Search + Role filter */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sigma-blue focus:border-transparent"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sigma-blue focus:border-transparent"
          >
            <option value="all">All Roles</option>
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchTerm || roleFilter !== 'all' ? 'No users found' : 'No users yet'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || roleFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Invite teachers and students to get started'}
          </p>
          {!searchTerm && roleFilter === 'all' && (
            <button
              onClick={() => navigate('/admin/users/invite')}
              className="px-6 py-3 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Invite First User
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((u) => {
                const displayRole: Role =
                  (u.role === 'super_admin' ? 'admin' : (u.role || 'student')) as Role;

                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-sigma-blue text-white flex items-center justify-center font-semibold">
                          {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{u.full_name || '(no name)'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-900">{u.email}</p>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(displayRole)}`}>
                          {displayRole.toUpperCase()}
                        </span>
                        {/* Inline role dropdown */}
                        <select
                          className="border rounded px-2 py-1 text-sm"
                          value={displayRole}
                          disabled={savingId === u.id}
                          onChange={(e) => updateUserRole(u.id, e.target.value as Role)}
                        >
                          <option value="student">Student</option>
                          <option value="teacher">Teacher</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!!u.is_active}
                          disabled={savingId === u.id}
                          onChange={(e) => updateUserActive(u.id, e.target.checked)}
                        />
                        <span>{u.is_active ? 'Active' : 'Inactive'}</span>
                      </label>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </p>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.id !== profile?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Remove User"
                          >
                            {/* Using an inline SVG to keep dependencies consistent */}
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                              <path d="M19 7l-1 13H6L5 7m3 0V5a2 2 0 012-2h4a2 2 0 012 2v2m-9 0h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
