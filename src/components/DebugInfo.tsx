import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';

const DebugInfo: React.FC = () => {
  const { user, profile, loading, refreshProfile, hasRLSIssue } = useAuth();
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
  }, [user, profile, loading, hasRLSIssue]);

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
        hasRLSIssue,
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
        hasData: !!data,
        isRLSError: error?.code === '42P17' || error?.message?.includes('infinite recursion')
      };
    } catch (err) {
      results.supabaseConnection = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        isRLSError: false
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

    // Test 3: Profile fetch (with RLS error detection)
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
          profileData: data ? `${data.email} (${data.role})` : null,
          isRLSError: error?.code === '42P17' || error?.message?.includes('infinite recursion'),
          errorCode: error?.code
        };
      } catch (err) {
        results.profileFetch = {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          isRLSError: false
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
        sample: data?.slice(0, 2).map(c => c.title) || [],
        isRLSError: error?.code === '42P17' || error?.message?.includes('infinite recursion')
      };
    } catch (err) {
      results.coursesFetch = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        isRLSError: false
      };
    }

    // Test 5: RLS Policy Test
    if (user) {
      try {
        // Try a simple select without any conditions to test basic RLS
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id')
          .limit(1);
        results.rlsPolicyTest = {
          success: !error,
          error: error?.message,
          isRLSError: error?.code === '42P17' || error?.message?.includes('infinite recursion'),
          errorCode: error?.code
        };
      } catch (err) {
        results.rlsPolicyTest = {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          isRLSError: true
        };
      }
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
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  };

  const handleRLSWorkaround = async () => {
    if (!user) {
      alert('No user logged in');
      return;
    }

    try {
      console.log('🛠️ Attempting RLS workaround...');
      
      // Try to create a basic profile using service role or admin functions
      // This would typically require a server-side function
      alert('RLS Workaround: This would require a server-side function to bypass RLS policies. Contact your database administrator to fix the infinite recursion in user_profiles RLS policies.');
      
    } catch (error) {
      console.error('RLS workaround failed:', error);
      alert(`RLS workaround failed: ${error}`);
    }
  };

  if (!isVisible) return null;

  const hasAnyRLSIssues = testResults && Object.values(testResults).some((result: any) => result?.isRLSError);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`bg-black text-white text-xs rounded-lg shadow-lg transition-all duration-300 ${
        isMinimized ? 'w-48' : 'w-80 max-w-sm'
      }`}>
        <div className="flex justify-between items-center p-3 border-b border-gray-600">
          <span className="font-bold flex items-center">
            🐛 Debug Info
            {hasRLSIssue && <span className="ml-2 text-red-400 animate-pulse">⚠️</span>}
          </span>
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
            {/* RLS Issue Alert */}
            {(hasRLSIssue || hasAnyRLSIssues) && (
              <div className="bg-red-900 border border-red-700 rounded p-2 mb-2">
                <div className="text-red-300 font-bold text-xs mb-1">🚨 RLS POLICY ISSUE DETECTED</div>
                <div className="text-red-200 text-xs mb-2">
                  Infinite recursion in user_profiles table policies
                </div>
                <button
                  onClick={handleRLSWorkaround}
                  className="bg-red-700 hover:bg-red-600 px-2 py-1 rounded text-xs w-full"
                >
                  Show RLS Fix Info
                </button>
              </div>
            )}

            {/* Quick Status */}
            <div className="space-y-1">
              <div>
                <strong>Auth:</strong> {loading ? '⏳ Loading' : user ? '✅ Logged in' : '❌ Not logged in'}
              </div>
              <div className="flex items-center">
                <strong>Profile:</strong> 
                {hasRLSIssue && <span className="ml-1 text-red-400">⚠️</span>}
                <span className={hasRLSIssue ? 'text-red-300 ml-1' : 'ml-1'}>
                  {profile ? `✅ ${profile.role}` : '❌ No profile'}
                </span>
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
                      <div className="flex items-center">
                        <strong>{key}:</strong> 
                        <span className="ml-1">
                          {result.success ? '✅' : '❌'}
                          {result.isRLSError && <span className="text-red-400 ml-1">🔄</span>}
                        </span>
                      </div>
                      {result.error && (
                        <div className={`ml-2 truncate ${result.isRLSError ? 'text-red-400' : 'text-red-300'}`}>
                          {result.isRLSError && '🚨 RLS: '}{result.error}
                        </div>
                      )}
                      {result.profileData && <div className="text-green-400 ml-2">{result.profileData}</div>}
                      {result.count !== undefined && <div className="text-blue-400 ml-2">Count: {result.count}</div>}
                      {result.errorCode && <div className="text-yellow-400 ml-2">Code: {result.errorCode}</div>}
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