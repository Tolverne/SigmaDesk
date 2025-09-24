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
      // Just try to get the Supabase health status
      const { error } = await supabase.auth.getSession();
      
      // If we can reach Supabase auth, we're connected
      setConnected(!error);
      console.log('Supabase connection test:', error ? 'Failed' : 'Success');
      if (error) console.error('Supabase error:', error);
    } catch (err) {
      console.error('Connection error:', err);
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
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <span className="text-sm text-gray-600">
                Vercel Deployment: Pending
              </span>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="mt-8 p-4 bg-sigma-blue bg-opacity-10 rounded-lg">
          <h3 className="text-lg font-semibold text-sigma-blue mb-2">
            Next Steps
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
            <li>Complete Supabase setup</li>
            <li>Deploy to Vercel</li>
            <li>Begin Phase 1: Authentication</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default HomePage;