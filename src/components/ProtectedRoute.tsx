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
  const [retryCount, setRetryCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    // Only set timeout if still loading
    if (loading) {
      const timer = setTimeout(() => {
        console.warn('⚠️ ProtectedRoute: Loading timeout reached');
        setTimeoutReached(true);
      }, 15000); // 15 second timeout - more generous

      return () => clearTimeout(timer);
    } else {
      // Reset timeout when loading completes
      setTimeoutReached(false);
      setRetryCount(0);
    }
  }, [loading, retryCount]);

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('🔐 ProtectedRoute State:', {
      loading,
      hasUser: !!user,
      userEmail: user?.email,
      hasProfile: !!profile,
      profileRole: profile?.role,
      timeoutReached,
      path: location.pathname
    });
  }

  // Show timeout error with retry options
  if (timeoutReached && loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Authentication Timeout
          </h2>
          <p className="text-gray-600 mb-4">
            We're having trouble verifying your login. This might be due to:
          </p>
          <ul className="text-left text-sm text-gray-600 mb-6 space-y-1">
            <li>• Slow network connection</li>
            <li>• Database connectivity issues</li>
            <li>• Session expiration</li>
          </ul>
          <div className="space-y-3">
            <button
              onClick={() => {
                console.log('🔄 User requested retry');
                setTimeoutReached(false);
                setRetryCount(prev => prev + 1);
                // Force a page refresh to restart auth
                window.location.reload();
              }}
              className="w-full px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Retry ({retryCount + 1}/3)
            </button>
            <button
              onClick={() => {
                console.log('🏠 User going to home page');
                window.location.href = '/';
              }}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Go to Home Page
            </button>
            <button
              onClick={() => {
                console.log('🔑 User going to login');
                window.location.href = '/login';
              }}
              className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            >
              Sign In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state with better feedback
  if (loading) {
    const loadingMessages = [
      'Verifying your login...',
      'Checking permissions...',
      'Loading your profile...',
      'Almost ready...'
    ];
    
    const messageIndex = Math.min(Math.floor(Date.now() / 2000) % loadingMessages.length, loadingMessages.length - 1);

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-sigma-blue mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-xs font-semibold text-sigma-blue">
                {Math.floor(Date.now() / 1000) % 4 + 1}
              </div>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            {loadingMessages[messageIndex]}
          </h3>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-sigma-blue h-2 rounded-full transition-all duration-1000"
              style={{ 
                width: `${Math.min(((Date.now() / 1000) % 15) * (100/15), 90)}%` 
              }}
            />
          </div>
          <p className="text-sm text-gray-600">
            Please wait while we set up your session...
          </p>
        </div>
      </div>
    );
  }

  // Check authentication - user must exist
  if (!user) {
    console.log('🔐 ProtectedRoute: No user found, redirecting to login');
    const from = location.pathname + location.search;
    return <Navigate to="/login" state={{ from }} replace />;
  }

  // Check role authorization if specified
  if (allowedRoles && allowedRoles.length > 0) {
    if (!profile) {
      // User exists but no profile - show profile setup message
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="text-blue-500 text-5xl mb-4">👤</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Profile Setup Required
            </h2>
            <p className="text-gray-600 mb-4">
              Your account needs a profile to access this area. This might be because:
            </p>
            <ul className="text-left text-sm text-gray-600 mb-6 space-y-1">
              <li>• Your account is new and still being set up</li>
              <li>• Database permissions need to be configured</li>
              <li>• An administrator needs to assign your role</li>
            </ul>
            <div className="space-y-3">
              <button
                onClick={() => {
                  console.log('🔄 Attempting profile refresh');
                  window.location.reload();
                }}
                className="w-full px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  console.log('📧 User needs help with profile');
                  alert('Please contact your administrator for help setting up your profile.\n\nUser ID: ' + user.id + '\nEmail: ' + user.email);
                }}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                Contact Admin
              </button>
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              >
                Go to Home Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Check if user's role is allowed
    if (!allowedRoles.includes(profile.role)) {
      console.log('🚫 ProtectedRoute: Role not allowed:', profile.role, 'Required:', allowedRoles);
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // All checks passed - render the protected content
  console.log('✅ ProtectedRoute: All checks passed for', user.email);
  return <>{children}</>;
};

export default ProtectedRoute;