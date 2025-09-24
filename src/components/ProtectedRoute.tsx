import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'student' | 'teacher' | 'admin' | 'super_admin'>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles 
}) => {
  const { user, profile, loading } = useAuth();
  const [showTimeout, setShowTimeout] = useState(false);
  const [timeoutCount, setTimeoutCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    // Progressive timeout handling
    const timeouts = [3000, 6000, 10000]; // 3s, 6s, 10s
    
    if (loading && timeoutCount < timeouts.length) {
      const timer = setTimeout(() => {
        if (loading) {
          console.warn(`⚠️ ProtectedRoute: Loading timeout ${timeoutCount + 1}`);
          setTimeoutCount(prev => prev + 1);
          
          if (timeoutCount >= timeouts.length - 1) {
            console.error('❌ ProtectedRoute: Final timeout, showing error');
            setShowTimeout(true);
          }
        }
      }, timeouts[timeoutCount]);

      return () => clearTimeout(timer);
    }
  }, [loading, timeoutCount]);

  // Reset timeout when loading changes
  useEffect(() => {
    if (!loading) {
      setTimeoutCount(0);
      setShowTimeout(false);
    }
  }, [loading]);

  // Show timeout error after multiple attempts
  if (showTimeout) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Connection Timeout
          </h2>
          <p className="text-gray-600 mb-6">
            We're having trouble connecting to our servers. This might be due to:
          </p>
          <ul className="text-left text-sm text-gray-600 mb-6 space-y-1">
            <li>• Slow internet connection</li>
            <li>• Server maintenance</li>
            <li>• Authentication issues</li>
          </ul>
          <div className="space-y-3">
            <button
              onClick={() => {
                setShowTimeout(false);
                setTimeoutCount(0);
                window.location.reload();
              }}
              className="w-full px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Retry Connection
            </button>
            <button
              onClick={() => {
                // Try to go to login
                window.location.href = '/login';
              }}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading with progress indicator
  if (loading) {
    const progressSteps = [
      'Connecting to server...',
      'Verifying authentication...',
      'Loading user profile...',
      'Almost ready...'
    ];

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sigma-blue mx-auto mb-4"></div>
            {timeoutCount > 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-xs text-gray-500 bg-white px-1 rounded">
                  {timeoutCount}
                </div>
              </div>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Loading...
          </h3>
          <p className="text-gray-600 mb-4">
            {progressSteps[Math.min(timeoutCount, progressSteps.length - 1)]}
          </p>
          
          {timeoutCount > 1 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Taking longer than usual. Checking connection...
              </p>
            </div>
          )}
          
          {timeoutCount > 2 && (
            <button
              onClick={() => {
                console.log('🔄 User requested retry');
                window.location.reload();
              }}
              className="mt-3 px-4 py-2 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Refresh Page
            </button>
          )}
        </div>
      </div>
    );
  }

  // Check authentication
  if (!user) {
    console.log('🔐 ProtectedRoute: No user, redirecting to login');
    // Store the current location to redirect back after login
    const from = location.pathname + location.search;
    return <Navigate to="/login" state={{ from }} replace />;
  }

  // Check role authorization
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    console.log('🚫 ProtectedRoute: Insufficient role permissions');
    return <Navigate to="/unauthorized" replace />;
  }

  // If user exists but no profile, show a different message
  if (user && !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <div className="text-blue-500 text-5xl mb-4">👤</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Setting up your profile...
          </h2>
          <p className="text-gray-600 mb-6">
            We're creating your user profile. This should only take a moment.
          </p>
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-2 py-1">
              <div className="h-2 bg-gray-300 rounded"></div>
              <div className="space-y-2">
                <div className="h-2 bg-gray-300 rounded w-5/6"></div>
                <div className="h-2 bg-gray-300 rounded w-4/6"></div>
              </div>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Refresh if this takes too long
          </button>
        </div>
      </div>
    );
  }

  // All checks passed, render children
  console.log('✅ ProtectedRoute: All checks passed, rendering children');
  return <>{children}</>;
};

export default ProtectedRoute;