import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
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
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Layout><HomePage /></Layout>} />
          <Route path="/unauthorized" element={<Layout><UnauthorizedPage /></Layout>} />
          
          {/* Course routes - viewable by all, enrollment required for lessons */}
          <Route path="/courses" element={<Layout><CoursesPage /></Layout>} />
          <Route path="/courses/:courseId" element={<Layout><CourseDetailPage /></Layout>} />
          <Route path="/test" element={
            <Layout>
              <div className="p-8">
                <h1 className="text-2xl mb-4">Route Test Page</h1>
                <p>If you can see this, routing is working!</p>
              </div>
            </Layout>
          } />
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
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;