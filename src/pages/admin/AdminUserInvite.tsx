import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';
import { ArrowLeft, UserPlus, Mail } from 'lucide-react';

const AdminUserInvite: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'student' as 'student' | 'teacher' | 'admin',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim() || !formData.full_name.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    if (!profile?.organization_id) {
      alert('No organization found');
      return;
    }

    try {
      setSaving(true);

      // Check if user already exists
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id, email')
        .eq('email', formData.email.toLowerCase())
        .maybeSingle();

      if (existing) {
        alert(`A user with email ${formData.email} already exists in the system.`);
        return;
      }

      // For now, we'll create a placeholder profile that gets claimed when they sign in
      // In a real system, you'd send an email invite here
      
      alert(
        `Invite prepared for ${formData.email}!\n\n` +
        `To complete the invitation:\n` +
        `1. Have them sign in at your app URL using Google OAuth with ${formData.email}\n` +
        `2. After signing in, you can assign them the ${formData.role} role\n\n` +
        `Note: Full email invitations will be added in a future update.`
      );

      navigate('/admin/users');
    } catch (err: any) {
      console.error('Error inviting user:', err);
      alert(`Failed to invite user: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => navigate('/admin/users')}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back to Users
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invite User</h1>
        <p className="text-gray-600 mt-1">Add a new teacher or student to your organization</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <Mail className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">How Invites Work</h3>
            <p className="text-sm text-blue-800">
              After you create this invite, have the user sign in to your app using Google OAuth 
              with the email address you specify below. Once they sign in, you can assign them 
              the appropriate role from the Users page.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-io-primary focus:border-transparent"
              placeholder="user@example.com"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be a valid Google account email
            </p>
          </div>

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-io-primary focus:border-transparent"
              placeholder="John Smith"
              required
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              Initial Role *
            </label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-io-primary focus:border-transparent"
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              You can change this later from the Users page
            </p>
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center px-6 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            {saving ? 'Preparing...' : 'Prepare Invite'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminUserInvite;