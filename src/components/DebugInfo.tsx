// Add this to src/components/DebugInfo.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';

const DebugInfo: React.FC = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [debugData, setDebugData] = useState<any>({});
  const [isVisible, setIsVisible] = useState(false);
  const [testResults, setTestResults] = useState<any>({});
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    // Only show in development or if URL contains debug=true
    const urlParams = new URLSearchParams(window.location.search);
    const showDebug = process.env.NODE_ENV === 'development' || urlParams.get('debug') === 'true';
    setIsVisible(showDebug);

    if (showDebug) {
      collectDebugInfo();
    }
  }, [user, profile, loading]);

  const collectDebugInfo = async () => {
    const info: any = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        reactAppEnv: process.env.REACT_APP_ENV,
        hasSupabaseUrl: !!process.env.REACT_APP_SUPABASE_URL,
        hasSupabaseKey: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
        supabaseUrl: process.env.REACT_APP_SUPABASE_URL?.substring(0, 50) + '...',
        location: window.location.href,
        userAgent: navigator.userAgent.substring(0, 100) + '...'
      },
      auth: {
        loading,
        hasUser: !!user,
        userEmail: user?.email,
        userId: user?.id,
        hasProfile: !!profile,
        profileRole: profile?.role,
        profileEmail: profile?.email,
        profileFullName: profile?.full_name,
        sessionExists: !!(await supabase.auth.getSession()).data.session
      },
      supabase: {
        clientExists: !!supabase,
        version: 'unknown'
      }
    };

    setDebugData(info);
  };

  const runTests = async () => {
    setTestResults({ testing: true });
    const results: any = {};

    // Test 1: Supabase connection
    try {
      const { data, error } = await supabase.from('organizations').select('count').limit(1);
      results.supabaseConnection = {
        success: !error,
        error: error?.message,
        hasData: !!data
      };
    } catch (err) {
      results.supabaseConnection = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }

    // Test 2: Auth session
    try {
      const { data, error } = await supabase.auth.getSession();
      results.authSession = {
        success: !error,
        hasSession: !!data.session,
        error: error?.message,
        userEmail: data.session?.user?.email
      };
    } catch (err) {
      results.authSession = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }

    // Test 3: Profile fetch
    if (user) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        results.profileFetch = {
          success: !error,
          hasProfile: !!data,
          error: error?.message,
          profileData: data ? `${data.email} (${data.role})` : null
        };
      } catch (err) {
        results.profileFetch = {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        };
      }
    }

    // Test 4: Courses fetch
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .limit(5);
      results.coursesFetch = {
        success: !error,
        hasData: !!data?.length,
        error: error?.message,
        count: data?.length || 0,
        sample: data?.slice(0, 2).map(c => c.title) || []
      };
    } catch (err) {
      results.coursesFetch = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }

    setTestResults(results);
  };

  const handleRefreshProfile = async () => {
    try {
      await refreshProfile();
      await collectDebugInfo();
      alert('Profile refresh attempted - check results');
    } catch (error) {
      alert(`Profile refresh failed: ${error}`);
    }
  };

  const handleForceSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Force sign out failed:', error);
      // Clear everything manually
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  };

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
              title={isMinimized ? 'Expand' : 'Minimize'}
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
          <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
            {/* Quick Status */}
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
                <strong>Env:</strong> {debugData.environment?.nodeEnv || 'unknown'}
              </div>
              <div>
                <strong>Supabase:</strong> {debugData.environment?.hasSupabaseUrl ? '✅' : '❌'} URL, {debugData.environment?.hasSupabaseKey ? '✅' : '❌'} Key
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border-t border-gray-600 pt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={runTests}
                  className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs"
                  disabled={testResults.testing}
                >
                  {testResults.testing ? 'Testing...' : 'Run Tests'}
                </button>
                <button
                  onClick={collectDebugInfo}
                  className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs"
                >
                  Refresh
                </button>
              </div>

              {user && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleRefreshProfile}
                    className="bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded text-xs"
                  >
                    Refresh Profile
                  </button>
                  <button
                    onClick={handleForceSignOut}
                    className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs"
                  >
                    Force Sign Out
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => window.location.href = '/test'}
                  className="bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-xs"
                >
                  Test Route
                </button>
                <button
                  onClick={() => window.location.href = '/debug'}
                  className="bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-xs"
                >
                  Debug Page
                </button>
              </div>
            </div>
            
            {/* Test Results */}
            {Object.keys(testResults).length > 0 && !testResults.testing && (
              <div className="border-t border-gray-600 pt-2">
                <strong>Test Results:</strong>
                <div className="space-y-1 mt-1">
                  {Object.entries(testResults).map(([key, result]: [string, any]) => (
                    <div key={key} className="text-xs">
                      <strong>{key}:</strong> {result.success ? '✅' : '❌'}
                      {result.error && <div className="text-red-400 ml-2 truncate">{result.error}</div>}
                      {result.profileData && <div className="text-green-400 ml-2">{result.profileData}</div>}
                      {result.count !== undefined && <div className="text-blue-400 ml-2">Count: {result.count}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Raw Debug Data */}
            <details className="border-t border-gray-600 pt-2">
              <summary className="cursor-pointer text-gray-400 text-xs">Raw Debug Data</summary>
              <pre className="text-xs mt-1 bg-gray-800 p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap">
                {JSON.stringify(debugData, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugInfo;