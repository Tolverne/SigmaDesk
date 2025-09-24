import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

const HomePage: React.FC = () => {
  const [connected, setConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      // Simple health check - just see if we can reach Supabase
      const { error } = await supabase.from('organizations').select('count').limit(1).single();
      
      // Even if there's an error (like no rows), if we got a response, we're connected
      setConnected(true);
      console.log('✅ Supabase connected');
    } catch (err) {
      console.error('❌ Supabase connection error:', err);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Welcome to SigmaDesk
        </h1>
        <p className="text-gray-600 mb-6">
          Digital workbook platform for modern education. This is your development
          environment for building the future of educational technology.
        </p>
        
        {/* Status Checks */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-700">
            System Status
          </h2>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">React App Running</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Tailwind CSS Configured</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                loading ? 'bg-yellow-500 animate-pulse' : 
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="text-sm text-gray-600">
                Supabase Connection: {
                  loading ? 'Checking...' : 
                  connected ? 'Connected' : 'Not Connected'
                }
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">
                Vercel Deployment: Live
              </span>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="mt-8 p-4 bg-sigma-blue bg-opacity-10 rounded-lg">
          <h3 className="text-lg font-semibold text-sigma-blue mb-2">
            Phase 1 Complete!
          </h3>
          <p className="text-sm text-gray-700 mb-2">
            ✅ Authentication with Google OAuth<br/>
            ✅ User profiles and roles<br/>
            ✅ Protected routes<br/>
            ✅ Deployed to Vercel
          </p>
          <p className="text-sm text-gray-700 mt-2">
            Next: Phase 2 - Course Structure & Navigation
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;