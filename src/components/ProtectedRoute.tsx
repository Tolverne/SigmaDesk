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
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [startTime] = useState(Date.now());
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      setTimeoutReached(false);
      return;
    }

    // Only timeout if loading for more than 30 seconds AND we've been on this page for at least 5 seconds
    // This prevents timeout when quickly navigating or switching tabs
    const minWaitTime = 5000;
    const maxWaitTime = 30000;

    const timer = setTimeout(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= minWaitTime) {
        console.warn('ProtectedRoute: Loading timeout reached after', elapsed, 'ms');
        setTimeoutReached(true);
      }
    }, maxWaitTime);

    return () => clearTimeout(timer);
  }, [loading, startTime]);

  // Show loading spinner with progress indicator
  if (loading && !timeoutReached) {
    const elapsed = Math.min(Date.now() - startTime, 30000);
    const progress = (elapsed / 30000) * 100;

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-io-primary mx-auto"></div>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Loading...
          </h3>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            Verifying your session
          </p>
        </div>
      </div>
    );
  }

  // Timeout error with retry
  if (timeoutReached && loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <div className="text-yellow-500 text-5xl mb-4">⏱️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Taking Longer Than Expected
          </h2>
          <p className="text-gray-600 mb-4">
            The connection is slow. This might be due to network issues.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setTimeoutReached(false);
                window.location.reload();
              }}
              className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700"
            >
              Retry
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" state={{ from }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!profile) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="text-blue-500 text-5xl mb-4">👤</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Profile Setup Required
            </h2>
            <p className="text-gray-600 mb-6">
              Contact your administrator for access.
            </p>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700"
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }

    if (!allowedRoles.includes(profile.role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;