import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import DebugInfo from './components/DebugInfo'; // Add this import
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import LessonPage from './pages/LessonPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Layout><HomePage /></Layout>} />
            <Route path="/unauthorized" element={<Layout><UnauthorizedPage /></Layout>} />
            
            {/* Simple test route for debugging routing issues */}
            <Route path="/test" element={
              <Layout>
                <div className="p-8 bg-white rounded-lg shadow">
                  <h1 className="text-2xl mb-4 text-green-600">✅ Route Test Success!</h1>
                  <p className="mb-4">If you can see this, basic routing is working!</p>
                  <div className="space-y-2 text-sm">
                    <p><strong>Current URL:</strong> {window.location.href}</p>
                    <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
                    <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
                  </div>
                  <div className="mt-4 space-x-2">
                    <button 
                      onClick={() => window.location.href = '/'}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Go Home
                    </button>
                    <button 
                      onClick={() => window.location.href = '/dashboard'}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Go to Dashboard
                    </button>
                    <button 
                      onClick={() => window.location.href = '/courses'}
                      className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                    >
                      Go to Courses
                    </button>
                  </div>
                </div>
              </Layout>
            } />
            
            {/* Debug route - only available in development or with ?debug=true */}
            <Route path="/debug" element={
              <Layout>
                <div className="p-8 bg-white rounded-lg shadow">
                  <h1 className="text-2xl mb-4">🐛 Debug Information</h1>
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Quick Tests</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button 
                          onClick={async () => {
                            console.log('Testing Supabase connection...');
                            try {
                              const { data, error } = await (window as any).supabase
                                .from('courses')
                                .select('count')
                                .limit(1);
                              alert(error ? `Error: ${error.message}` : 'Supabase connection: OK');
                            } catch (err) {
                              alert(`Connection failed: ${err}`);
                            }
                          }}
                          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Test Supabase Connection
                        </button>
                        <button 
                          onClick={() => {
                            console.log('Current window objects:', {
                              supabase: !!(window as any).supabase,
                              location: window.location.href,
                              userAgent: navigator.userAgent
                            });
                            alert('Check console for debug info');
                          }}
                          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          Log Debug Info
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Environment Variables</h2>
                      <div className="bg-gray-100 p-3 rounded text-sm font-mono">
                        <div>NODE_ENV: {process.env.NODE_ENV}</div>
                        <div>REACT_APP_SUPABASE_URL: {process.env.REACT_APP_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</div>
                        <div>REACT_APP_SUPABASE_ANON_KEY: {process.env.REACT_APP_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</div>
                      </div>
                    </div>
                    
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Navigation Test</h2>
                      <div className="space-x-2">
                        <a href="/courses" className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 inline-block">
                          Test /courses
                        </a>
                        <a href="/dashboard" className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 inline-block">
                          Test /dashboard (protected)
                        </a>
                        <a href="/nonexistent" className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 inline-block">
                          Test 404 handling
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </Layout>
            } />
            
            {/* Course routes - viewable by all, enrollment required for lessons */}
            <Route path="/courses" element={<Layout><CoursesPage /></Layout>} />
            <Route path="/courses/:courseId" element={<Layout><CourseDetailPage /></Layout>} />
            
            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout><DashboardPage /></Layout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/courses/:courseId/lessons/:lessonId"
              element={
                <ProtectedRoute>
                  <Layout><LessonPage /></Layout>
                </ProtectedRoute>
              }
            />
            
            {/* Catch all - redirect to home instead of specific route */}
            <Route path="*" element={
              <Layout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
                  <p className="text-gray-600 mb-4">The page you're looking for doesn't exist.</p>
                  <div className="space-x-4">
                    <button 
                      onClick={() => window.location.href = '/'}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Go Home
                    </button>
                    <button 
                      onClick={() => window.location.href = '/courses'}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Browse Courses
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    Current path: {window.location.pathname}
                  </p>
                </div>
              </Layout>
            } />
          </Routes>
          
          {/* Debug component - shows only in development or with ?debug=true */}
          <DebugInfo />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;