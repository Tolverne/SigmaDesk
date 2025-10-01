import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    try {
      setIsSigningOut(true);
      console.log('Layout: Starting sign out process...');
      await signOut();
      console.log('Layout: Redirecting to login...');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Layout: Error during sign out:', error);
      navigate('/login', { replace: true });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-sigma-light">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
                <span className="text-2xl font-bold text-sigma-blue">Σ</span>
                <span className="ml-2 text-xl font-semibold text-gray-800">
                  SigmaDesk
                </span>
              </Link>
              <span className="ml-4 text-sm text-gray-500 italic hidden sm:inline">
                Where Every Step Counts
              </span>
            </div>

            <nav className="flex items-center space-x-4">
              {user ? (
                <>
                  <Link
                    to="/courses"
                    className={`text-gray-600 hover:text-gray-800 transition-colors ${
                      location.pathname.startsWith('/courses') ? 'text-sigma-blue font-semibold' : ''
                    }`}
                  >
                    Courses
                  </Link>

                  <Link
                    to="/dashboard"
                    className={`text-gray-600 hover:text-gray-800 transition-colors ${
                      location.pathname === '/dashboard' ? 'text-sigma-blue font-semibold' : ''
                    }`}
                  >
                    Dashboard
                  </Link>

                  {profile?.role && profile.role !== 'student' && (
                    <Link
                      to="/manage"
                      className="text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Manage
                    </Link>
                  )}

                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {profile?.full_name || user.email}
                    </span>

                    {profile?.role && (
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          profile.role === 'admin' || profile.role === 'super_admin'
                            ? 'bg-red-100 text-red-800'
                            : profile.role === 'teacher'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {profile.role.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="px-3 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Sign In
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {process.env.NODE_ENV === 'development' && (
        <footer className="bg-gray-800 text-white p-2 text-xs">
          <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
            <span>Development Mode</span>
            <span>
              User: {user ? '✅' : '❌'} |{' '}
              Profile: {profile ? `✅ ${profile.role}` : '❌'} |{' '}
              Path: {location.pathname}
            </span>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;