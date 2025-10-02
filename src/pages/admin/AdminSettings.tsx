import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, Building, Shield } from 'lucide-react';

const AdminSettings: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your organization settings</p>
      </div>

      <div className="space-y-6">
        {/* Organization Settings */}
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Building className="w-6 h-6 text-gray-600 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">Organization</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Organization ID</label>
              <p className="text-gray-900 font-mono text-sm mt-1">
                {profile?.organization_id}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Your Role</label>
              <p className="text-gray-900 mt-1">
                <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-semibold rounded-full">
                  {profile?.role?.toUpperCase()}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Shield className="w-6 h-6 text-gray-600 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">Security</h2>
          </div>
          <p className="text-gray-600 text-sm">Security settings coming soon...</p>
        </div>

        {/* Additional Settings */}
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Settings className="w-6 h-6 text-gray-600 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
          </div>
          <p className="text-gray-600 text-sm">Additional settings coming soon...</p>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;