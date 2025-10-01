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
  const location = useLocation();

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.warn('ProtectedRoute: Loading timeout reached');
        setTimeoutReached(true);
      }, 15000);

      return () => clearTimeout(timer);
    } else {
      setTimeoutReached(false);
    }
  }, [loading]);

  if (timeoutReached && loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Authentication Timeout
          </h2>
          <p className="text-gray-600 mb-4">
            We're having trouble verifying your login.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700"
            >
              Retry
            </button>
            <button
              onClick={() => { window.location.href = '/login'; }}
              className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Sign In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-sigma-blue mx-auto"></div>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Loading...
          </h3>
          <p className="text-sm text-gray-600">
            Please wait while we verify your session
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('ProtectedRoute: No user found, redirecting to login');
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
              Your account needs a profile to access this area. Please contact your administrator.
            </p>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700"
            >
              Go to Home Page
            </button>
          </div>
        </div>
      );
    }

    if (!allowedRoles.includes(profile.role)) {
      console.log('ProtectedRoute: Role not allowed:', profile.role);
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;