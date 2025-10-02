import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import DebugInfo from './components/DebugInfo';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import LessonPage from './pages/LessonPage';

import NotFoundPage from './pages/NotFound';
import { useNavigate } from 'react-router-dom';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLayout from './components/admin/AdminLayout';
import AdminCourses from './pages/admin/AdminCourses';
import AdminClasses from './pages/admin/AdminClasses';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSettings from './pages/admin/AdminSettings';
import AdminCourseForm from './pages/admin/AdminCourseForm';
import AdminTopicForm from './pages/admin/AdminTopicForm';
import AdminLessonForm from './pages/admin/AdminLessonForm';

import AdminUserInvite from './pages/admin/AdminUserInvite';
import AdminClassForm from './pages/admin/AdminClassForm';



// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🔴 React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="text-red-500 text-5xl mb-4">💥</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-4">
              The application encountered an unexpected error.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-sigma-blue text-white rounded-md hover:bg-blue-700"
              >
                Reload Application
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.href = '/';
                }}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                Reset and Go Home
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Small component to render the /test route using client-side navigation */
function TestRouteContent() {
  const navigate = useNavigate();
  return (
    <div className="p-8 bg-white rounded-lg shadow">
      <h1 className="text-2xl mb-4 text-green-600">✅ Route Test Success!</h1>
      <p className="mb-4">If you can see this, routing is working correctly!</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">System Info</h2>
          <div className="space-y-1 text-sm">
            <p><strong>Current URL:</strong> {window.location.href}</p>
            <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
            <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
            <p><strong>React Version:</strong> {React.version}</p>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Environment Check</h2>
          <div className="space-y-1 text-sm">
            <p><strong>Supabase URL:</strong> {process.env.REACT_APP_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</p>
            <p><strong>Supabase Key:</strong> {process.env.REACT_APP_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</p>
            <p><strong>Local Storage:</strong> {typeof(Storage) !== "undefined" ? '✅ Available' : '❌ Not available'}</p>
          </div>
        </div>
      </div>

      <div className="space-x-2 mb-4">
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          🏠 Home
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => navigate('/courses')}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          📚 Courses
        </button>
        <button
          onClick={() => navigate('/debug')}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          🐛 Debug
        </button>
      </div>

      <div className="text-xs text-gray-500">
        <p>✅ React Router working</p>
        <p>✅ Layout component rendering</p>
        <p>✅ Tailwind CSS styles applied</p>
        <p>✅ Environment variables loaded</p>
      </div>
    </div>
  );
}

/** Small component to render the inline 404 content if you ever need it again.
 *  We now use a dedicated NotFoundPage instead (outside Layout), which fixes the auth break issue.
 */

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <div className="App">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout><HomePage /></Layout>} />
              <Route path="/unauthorized" element={<Layout><UnauthorizedPage /></Layout>} />

              {/* Debug and Test routes */}
              <Route
                path="/test"
                element={
                  <Layout>
                    <TestRouteContent />
                  </Layout>
                }
              />

              <Route
                path="/debug"
                element={
                  <Layout>
                    <div className="p-8 bg-white rounded-lg shadow">
                      <h1 className="text-2xl mb-4">🐛 Debug Dashboard</h1>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h2 className="text-lg font-semibold mb-2">Quick Tests</h2>
                          <div className="space-y-2">
                            <button
                              onClick={async () => {
                                console.log('🔧 Testing Supabase connection...');
                                try {
                                  const { data, error } = await (window as any).supabase
                                    .from('courses')
                                    .select('count')
                                    .limit(1);
                                  console.log('📊 Result:', { data, error });
                                  alert(error ? `❌ Error: ${error.message}` : '✅ Supabase connection: OK');
                                } catch (err) {
                                  console.error('💥 Connection failed:', err);
                                  alert(`💥 Connection failed: ${err}`);
                                }
                              }}
                              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Test Supabase Connection
                            </button>

                            <button
                              onClick={async () => {
                                console.log('🔐 Testing auth session...');
                                try {
                                  const { data, error } = await (window as any).supabase.auth.getSession();
                                  console.log('📊 Session result:', { data, error });
                                  alert(data.session ? `✅ Session active: ${data.session.user.email}` : '❌ No active session');
                                } catch (err) {
                                  console.error('💥 Session check failed:', err);
                                  alert(`💥 Session check failed: ${err}`);
                                }
                              }}
                              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                            >
                              Check Auth Session
                            </button>

                            <button
                              onClick={() => {
                                const info = {
                                  supabase: !!(window as any).supabase,
                                  location: window.location.href,
                                  userAgent: navigator.userAgent.substring(0, 50),
                                  localStorage: typeof Storage !== 'undefined',
                                  cookies: document.cookie.length > 0,
                                  timestamp: new Date().toISOString(),
                                };
                                console.log('📊 Browser info:', info);
                                alert('📊 Check console for detailed browser information');
                              }}
                              className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                            >
                              Log Browser Info
                            </button>
                          </div>
                        </div>

                        <div>
                          <h2 className="text-lg font-semibold mb-2">Navigation Test</h2>
                          <div className="space-y-2">
                            {/* Keeping these as <a> for direct-navigation test is useful */}
                            <a
                              href="/courses"
                              className="block px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-center"
                            >
                              🎯 Test /courses (direct)
                            </a>
                            <a
                              href="/dashboard"
                              className="block px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-center"
                            >
                              🔒 Test /dashboard (protected)
                            </a>
                            <a
                              href="/nonexistent"
                              className="block px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-center"
                            >
                              🚫 Test 404 handling
                            </a>
                          </div>

                          <h2 className="text-lg font-semibold mt-4 mb-2">Auth Actions</h2>
                          <div className="space-y-2">
                            <button
                              onClick={() => (window as any).routerNavigate?.('/login')}
                              className="w-full px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600"
                            >
                              🔑 Go to Login
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await (window as any).supabase.auth.signOut();
                                  alert('✅ Signed out successfully');
                                  (window as any).routerNavigate?.('/login');
                                } catch (err) {
                                  alert(`❌ Sign out failed: ${err}`);
                                }
                              }}
                              className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                            >
                              🚪 Force Sign Out
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h2 className="text-lg font-semibold mb-2">Environment Status</h2>
                        <div className="text-sm space-y-1">
                          <div>
                            NODE_ENV:{' '}
                            <span className="font-mono bg-gray-200 px-1 rounded">
                              {process.env.NODE_ENV}
                            </span>
                          </div>
                          <div>
                            Supabase URL:{' '}
                            <span
                              className={`font-mono px-1 rounded ${
                                process.env.REACT_APP_SUPABASE_URL
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {process.env.REACT_APP_SUPABASE_URL ? '✅ Configured' : '❌ Missing'}
                            </span>
                          </div>
                          <div>
                            Supabase Key:{' '}
                            <span
                              className={`font-mono px-1 rounded ${
                                process.env.REACT_APP_SUPABASE_ANON_KEY
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {process.env.REACT_APP_SUPABASE_ANON_KEY ? '✅ Configured' : '❌ Missing'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Layout>
                }
              />

              {/* Course routes - accessible to all authenticated users */}
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

                <Route path="/admin/*" element={
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                    <Routes>
                      <Route path="/" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
                      <Route path="/courses" element={<AdminLayout><AdminCourses /></AdminLayout>} />
                      <Route path="/courses/new" element={<AdminLayout><AdminCourseForm /></AdminLayout>} />
                      <Route path="/courses/:courseId" element={<AdminLayout><AdminCourseForm /></AdminLayout>} />
                      <Route path="/courses/:courseId/topics/new" element={<AdminLayout><AdminTopicForm /></AdminLayout>} />
                      <Route path="/courses/:courseId/topics/:topicId" element={<AdminLayout><AdminTopicForm /></AdminLayout>} />
                      <Route path="/courses/:courseId/topics/:topicId/lessons/new" element={<AdminLayout><AdminLessonForm /></AdminLayout>} />
                      <Route path="/courses/:courseId/topics/:topicId/lessons/:lessonId" element={<AdminLayout><AdminLessonForm /></AdminLayout>} />
                      <Route path="/classes" element={<AdminLayout><AdminClasses /></AdminLayout>} />
                      <Route path="/users" element={<AdminLayout><AdminUsers /></AdminLayout>} />
                      <Route path="/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
                      <Route path="/users/invite" element={<AdminLayout><AdminUserInvite /></AdminLayout>} />
                      <Route path="/classes/new" element={<AdminLayout><AdminClassForm /></AdminLayout>} />
                      <Route path="/classes/:classId" element={<AdminLayout><AdminClassForm /></AdminLayout>} />
                    </Routes>
                  </ProtectedRoute>
                } />





              {/* Standalone 404 (NOT wrapped in Layout) */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>

            {/* Debug component - shows in development */}
            <DebugInfo />
          </div>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;