// Add this to src/components/DebugInfo.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';

const DebugInfo: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [debugData, setDebugData] = useState<any>({});
  const [isVisible, setIsVisible] = useState(false);
  const [testResults, setTestResults] = useState<any>({});

  useEffect(() => {
    // Only show in development or if URL contains debug=true
    const urlParams = new URLSearchParams(window.location.search);
    const showDebug = process.env.NODE_ENV === 'development' || urlParams.get('debug') === 'true';
    setIsVisible(showDebug);

    if (showDebug) {
      collectDebugInfo();
    }
  }, [user, profile]);

  const collectDebugInfo = async () => {
    const info: any = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        reactAppEnv: process.env.REACT_APP_ENV,
        hasSupabaseUrl: !!process.env.REACT_APP_SUPABASE_URL,
        hasSupabaseKey: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
        supabaseUrl: process.env.REACT_APP_SUPABASE_URL?.substring(0, 30) + '...',
        location: window.location.href,
        userAgent: navigator.userAgent.substring(0, 100) + '...'
      },
      auth: {
        loading,
        hasUser: !!user,
        userEmail: user?.email,
        hasProfile: !!profile,
        profileRole: profile?.role,
        userId: user?.id
      },
      supabase: {
        clientExists: !!supabase,
        version: 'unknown' // Could be extracted if needed
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
        error: error?.message
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
          .single();
        results.profileFetch = {
          success: !error,
          hasProfile: !!data,
          error: error?.message
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
        .limit(1);
      results.coursesFetch = {
        success: !error,
        hasData: !!data?.length,
        error: error?.message,
        count: data?.length || 0
      };
    } catch (err) {
      results.coursesFetch = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }

    setTestResults(results);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-black text-white text-xs p-3 rounded-lg shadow-lg max-w-sm">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold">🐛 Debug Info</span>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-1 max-h-64 overflow-y-auto">
          <div>
            <strong>Auth:</strong> {loading ? '⏳ Loading' : user ? '✅ Logged in' : '❌ Not logged in'}
          </div>
          <div>
            <strong>Profile:</strong> {profile ? `✅ ${profile.role}` : '❌ No profile'}
          </div>
          <div>
            <strong>Env:</strong> {debugData.environment?.nodeEnv || 'unknown'}
          </div>
          <div>
            <strong>Supabase:</strong> {debugData.environment?.hasSupabaseUrl ? '✅' : '❌'} URL, {debugData.environment?.hasSupabaseKey ? '✅' : '❌'} Key
          </div>
          
          <div className="border-t border-gray-600 pt-2 mt-2">
            <button
              onClick={runTests}
              className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs w-full mb-2"
              disabled={testResults.testing}
            >
              {testResults.testing ? 'Testing...' : 'Run Tests'}
            </button>
            
            {Object.keys(testResults).length > 0 && !testResults.testing && (
              <div className="space-y-1">
                {Object.entries(testResults).map(([key, result]: [string, any]) => (
                  <div key={key}>
                    <strong>{key}:</strong> {result.success ? '✅' : '❌'}
                    {result.error && <div className="text-red-400 text-xs ml-2">{result.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <details className="mt-2">
            <summary className="cursor-pointer text-gray-400">Raw Debug Data</summary>
            <pre className="text-xs mt-1 bg-gray-800 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
};

export default DebugInfo;