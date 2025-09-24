// Add this component to show when RLS issues are detected
// src/components/RLSErrorBanner.tsx

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const RLSErrorBanner: React.FC = () => {
  const { hasRLSIssue, user } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!hasRLSIssue || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    // Store dismissal in localStorage to persist across sessions
    localStorage.setItem('rls-error-dismissed', Date.now().toString());
  };

  return (
    <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <div className="text-red-400 text-xl">⚠️</div>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Database Configuration Issue Detected
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p className="mb-2">
              There's an issue with the database security policies that's preventing your profile from loading correctly.
              You're currently signed in as <strong>{user?.email}</strong>, but with limited functionality.
            </p>
            
            <div className="space-y-1 text-xs">
              <p><strong>What this means:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>You can still browse courses and use basic features</li>
                <li>Some personalized features may not work properly</li>
                <li>Your profile role is temporarily set to 'student'</li>
              </ul>
              
              <p className="mt-2"><strong>Technical Details:</strong></p>
              <p className="ml-2 font-mono text-xs bg-red-100 p-1 rounded">
                Error: Infinite recursion in user_profiles RLS policies
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <div className="mt-3 p-2 bg-red-100 rounded">
                <p className="font-semibold text-xs">For Developers:</p>
                <div className="text-xs space-y-1">
                  <p>• Check Supabase Row Level Security policies on user_profiles table</p>
                  <p>• Look for policies that reference auth.uid() and query the same table</p>
                  <p>• Run the SQL fix provided in the RLS Policy Fix artifact</p>
                  <p>• Consider disabling RLS temporarily for testing</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4 flex space-x-2">
            <button
              onClick={() => window.location.reload()}
              className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm transition-colors"
            >
              Try Again
            </button>
            
            <button
              onClick={handleDismiss}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded text-sm transition-colors"
            >
              Continue Anyway
            </button>
            
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `RLS Error Report:\n` +
                  `User: ${user?.email}\n` +
                  `Error: Infinite recursion in user_profiles policies\n` +
                  `Time: ${new Date().toISOString()}\n` +
                  `URL: ${window.location.href}`
                );
                alert('Error details copied to clipboard');
              }}
              className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded text-sm transition-colors"
            >
              Copy Error Details
            </button>
          </div>
        </div>
        
        <div className="flex-shrink-0 ml-4">
          <button
            onClick={handleDismiss}
            className="text-red-400 hover:text-red-600"
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RLSErrorBanner;