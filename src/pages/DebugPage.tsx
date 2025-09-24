import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

const DebugPage: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  
  useEffect(() => {
    const runDebug = async () => {
      const info: any = {};
      
      // Check environment variables
      info.hasUrl = !!process.env.REACT_APP_SUPABASE_URL;
      info.hasKey = !!process.env.REACT_APP_SUPABASE_ANON_KEY;
      info.url = process.env.REACT_APP_SUPABASE_URL;
      
      // Check Supabase client
      info.clientExists = !!supabase;
      
      // Try to get session
      try {
        const { data: session, error } = await supabase.auth.getSession();
        info.sessionCheck = { 
          hasSession: !!session?.session,
          error: error?.message,
          user: session?.session?.user?.email
        };
      } catch (err) {
        info.sessionError = err;
      }
      
      // Try to query database
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('count')
          .limit(1);
        info.dbCheck = { success: !error, error: error?.message };
      } catch (err) {
        info.dbError = err;
      }
      
      setDebugInfo(info);
    };
    
    runDebug();
  }, []);
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Debug Information</h1>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
      
      <div className="mt-4 space-y-2">
        <button 
          onClick={async () => {
            const { error } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: window.location.origin }
            });
            console.log('Login attempt:', error);
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Test Login
        </button>
        
        <button 
          onClick={async () => {
            const { error } = await supabase.auth.signOut();
            console.log('Logout attempt:', error);
            window.location.reload();
          }}
          className="px-4 py-2 bg-red-500 text-white rounded ml-2"
        >
          Test Logout
        </button>
      </div>
    </div>
  );
};

export default DebugPage;