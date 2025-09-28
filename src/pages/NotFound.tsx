import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearErrors, user } = useAuth();

  // Clear transient errors when showing the 404 page
  useEffect(() => {
    if (typeof clearErrors === 'function') {
      clearErrors();
    }
  }, [clearErrors]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-lg mx-auto p-8 bg-white rounded-lg shadow">
        <div className="text-6xl mb-6">🔍</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Page Not Found</h1>
        <p className="text-gray-600 mb-6">
          The page <code className="bg-gray-100 px-1 rounded">{location.pathname}</code> 
          doesn’t exist or may have been moved.
        </p>


        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700"
          >
            🏠 Go Home
          </button>
          <button
            onClick={() => navigate('/courses')}
            className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            📚 Browse Courses
          </button>
          {user && (
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
            >
              📊 Go to Dashboard
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          >
            ⬅️ Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
