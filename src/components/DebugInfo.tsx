import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';

const DebugInfo: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const showDebug = process.env.NODE_ENV === 'development' || urlParams.get('debug') === 'true';
    setIsVisible(showDebug);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`bg-black text-white text-xs rounded-lg shadow-lg transition-all duration-300 ${
        isMinimized ? 'w-48' : 'w-80 max-w-sm'
      }`}>
        <div className="flex justify-between items-center p-3 border-b border-gray-600">
          <span className="font-bold">🐛 Debug Info</span>
          <div className="flex space-x-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-gray-400 hover:text-white text-lg"
            >
              {isMinimized ? '□' : '−'}
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
        
        {!isMinimized && (
          <div className="p-3 space-y-2">
            <div className="space-y-1">
              <div>
                <strong>Auth:</strong> {loading ? '⏳ Loading' : user ? '✅ Logged in' : '❌ Not logged in'}
              </div>
              <div>
                <strong>Profile:</strong> {profile ? `✅ ${profile.role}` : '❌ No profile'}
              </div>
              <div>
                <strong>Email:</strong> {user?.email || 'None'}
              </div>
              <div>
                <strong>Org:</strong> {profile?.organization_id?.slice(0, 8) || 'None'}
              </div>
            </div>

            <div className="border-t border-gray-600 pt-2 space-y-2">
              <button
                onClick={() => window.location.href = '/test'}
                className="w-full bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-xs"
              >
                Test Route
              </button>
              <button
                onClick={() => window.location.href = '/debug'}
                className="w-full bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-xs"
              >
                Debug Page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugInfo;