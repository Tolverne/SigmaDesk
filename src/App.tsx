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

import LessonRedirect from './pages/LessonRedirect';

import ClassAnalyticsPage from './pages/analytics/ClassAnalyticsPage';
import AnalyticsHomePage from './pages/analytics/AnalyticsHomePage';

import LandingPage from './pages/marketing/LandingPage';


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
    console.error('React Error Boundary caught an error:', error, errorInfo);
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
                className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700"
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

function TestRouteContent() {
  const navigate = useNavigate();
  return (
    <div className="p-8 bg-white rounded-lg shadow">
      <h1 className="text-2xl mb-4 text-green-600">Route Test Success!</h1>
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
            <p><strong>Supabase URL:</strong> {process.env.REACT_APP_SUPABASE_URL ? 'Set' : 'Missing'}</p>
            <p><strong>Supabase Key:</strong> {process.env.REACT_APP_SUPABASE_ANON_KEY ? 'Set' : 'Missing'}</p>
            <p><strong>Local Storage:</strong> {typeof(Storage) !== "undefined" ? 'Available' : 'Not available'}</p>
          </div>
        </div>
      </div>

      <div className="space-x-2 mb-4">
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Home
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Dashboard
        </button>
        <button
          onClick={() => navigate('/courses')}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Courses
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <div className="App">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<LandingPage />} />
              <Route path="/unauthorized" element={<Layout><UnauthorizedPage /></Layout>} />
              <Route
                path="/courses/:courseId/classes/:classId/lessons/:lessonId/analytics"
                element={<ClassAnalyticsPage />}
              />
              <Route path="/analytics" element={<AnalyticsHomePage />} />
              {/* Debug and Test routes */}
              <Route path="/test" element={<Layout><TestRouteContent /></Layout>} />
              <Route
                path="/debug"
                element={
                  <Layout>
                    <div className="p-8 bg-white rounded-lg shadow">
                      <h1 className="text-2xl mb-4">Debug Dashboard</h1>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h2 className="text-lg font-semibold mb-2">Quick Tests</h2>
                          <div className="space-y-2">
                            <button
                              onClick={async () => {
                                console.log('Testing Supabase connection...');
                                try {
                                  const { data, error } = await (window as any).supabase
                                    .from('courses')
                                    .select('count')
                                    .limit(1);
                                  console.log('Result:', { data, error });
                                  alert(error ? `Error: ${error.message}` : 'Supabase connection: OK');
                                } catch (err) {
                                  console.error('Connection failed:', err);
                                  alert(`Connection failed: ${err}`);
                                }
                              }}
                              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Test Supabase Connection
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Layout>
                }
              />

              {/* Protected Dashboard */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout><DashboardPage /></Layout>
                  </ProtectedRoute>
                }
              />

              {/* Course routes - NEW STRUCTURE */}
              
              {/* Course list - accessible to all authenticated */}
              <Route 
                path="/courses" 
                element={<Layout><CoursesPage /></Layout>} 
              />
              
              {/* Course detail with optional class context */}
              {/* This handles both:
                  - /courses/:courseId (teachers see class selector, students see course)
                  - /courses/:courseId/classes/:classId (class-aware view) */}
              <Route 
                path="/courses/:courseId" 
                element={<Layout><CourseDetailPage /></Layout>} 
              />
              <Route 
                path="/courses/:courseId/classes/:classId" 
                element={<Layout><CourseDetailPage /></Layout>} 
              />

              {/* Lesson with explicit class context (teachers and students after redirect) */}
              <Route
                path="/courses/:courseId/classes/:classId/lessons/:lessonId"
                element={
                  <ProtectedRoute>
                    <Layout><LessonPage /></Layout>
                  </ProtectedRoute>
                }
              />

              {/* Legacy lesson route - auto-redirects to class-aware URL */}
              <Route
                path="/courses/:courseId/lessons/:lessonId"
                element={
                  <ProtectedRoute>
                    <Layout><LessonRedirect /></Layout>
                  </ProtectedRoute>
                }
              />

              {/* Admin routes */}
              <Route 
                path="/admin/*" 
                element={
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
                      <Route path="/classes/new" element={<AdminLayout><AdminClassForm /></AdminLayout>} />
                      <Route path="/classes/:classId" element={<AdminLayout><AdminClassForm /></AdminLayout>} />
                      <Route path="/users" element={<AdminLayout><AdminUsers /></AdminLayout>} />
                      <Route path="/users/invite" element={<AdminLayout><AdminUserInvite /></AdminLayout>} />
                      <Route path="/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
                    </Routes>
                  </ProtectedRoute>
                } 
              />

              {/* 404 - NOT wrapped in Layout */}
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