import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { courseService } from '../services/courseService';
import { Course } from '../types/course.types';
import CourseCard from '../components/CourseCard';

const DashboardPage: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  // Load enrolled courses once the user is known; abort safely on unmount/nav
  useEffect(() => {
    if (!user?.id) {
      setEnrolledCourses([]);
      setLoadingCourses(false);
      setCoursesError(null);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const load = async () => {
      setLoadingCourses(true);
      setCoursesError(null);

      try {
        const courses = await courseService.getEnrolledCourses(user.id, { signal });
        if (!signal.aborted) setEnrolledCourses(courses);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Error loading enrolled courses:', err);
          if (!signal.aborted) setCoursesError('Failed to load your courses. Please try again.');
        }
      } finally {
        if (!signal.aborted) setLoadingCourses(false);
      }
    };

    load();
    return () => controller.abort();
  }, [user?.id]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const getRoleBadgeColor = (role: string | undefined) => {
    switch (role) {
      case 'admin':
      case 'super_admin':
        return 'bg-red-100 text-red-800';
      case 'teacher':
        return 'bg-green-100 text-green-800';
      case 'student':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const role = profile?.role;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">User Information</h2>
            <div className="space-y-3">
              <div className="flex items-center">
                <span className="text-gray-600 w-32">Email:</span>
                <span className="text-gray-800">{user?.email}</span>
              </div>

              <div className="flex items-center">
                <span className="text-gray-600 w-32">Name:</span>
                <span className="text-gray-800">{profile?.full_name || 'Not set'}</span>
              </div>

              <div className="flex items-center">
                <span className="text-gray-600 w-32">Role:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(role)}`}>
                  {role?.toUpperCase() || 'PENDING'}
                </span>
              </div>

              <div className="flex items-center">
                <span className="text-gray-600 w-32">User ID:</span>
                <span className="text-gray-400 text-sm font-mono">{user?.id}</span>
              </div>
            </div>
          </div>

          {/* Role-specific content */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">
              {role === 'teacher' && 'Teacher Tools'}
              {role === 'admin' && 'Admin Controls'}
              {role === 'super_admin' && 'Super Admin Panel'}
              {role === 'student' && 'Student Resources'}
              {!role && 'Getting Started'}
            </h3>

            <div className="space-y-2 text-gray-600">
              {role === 'student' && (
                <>
                  <p>• View enrolled courses</p>
                  <p>• Complete assignments</p>
                  <p>• Track progress</p>
                </>
              )}

              {role === 'teacher' && (
                <>
                  <p>• Manage classes</p>
                  <p>• Review student work</p>
                  <p>• Create shared canvases</p>
                </>
              )}

              {(role === 'admin' || role === 'super_admin') && (
                <>
                  <p>• Manage users</p>
                  <p>• Create courses</p>
                  <p>• View analytics</p>
                  {role === 'super_admin' && <p>• System configuration</p>}
                </>
              )}

              {!role && (
                <p>Your account is being set up. Please wait for role assignment.</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <button
                className="p-4 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
                onClick={() => navigate('/courses')}
              >
                Browse Courses
              </button>

              {/* NEW: Universal Analytics entry point */}
              <button
                className="p-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                onClick={() => navigate('/analytics')}
              >
                Analytics
              </button>

              {role !== 'student' && (
                <button
                  className="p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  onClick={() => navigate('/manage')}
                >
                  Management Panel
                </button>
              )}

              <button
                className="p-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                onClick={() => navigate('/profile')}
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* My Courses Section */}
          {role === 'student' && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-700">My Courses</h3>
                {enrolledCourses.length > 2 && (
                  <button
                    onClick={() => navigate('/courses')}
                    className="text-primary hover:underline text-sm"
                  >
                    View all courses →
                  </button>
                )}
              </div>

              {loadingCourses ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-io-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading courses...</p>
                </div>
              ) : coursesError ? (
                <div className="text-center py-8 bg-red-50 rounded-lg">
                  <p className="text-red-600 mb-3">{coursesError}</p>
                  <button
                    onClick={() => {
                      courseService.clearCache();
                      const controller = new AbortController();
                      const { signal } = controller;
                      setLoadingCourses(true);
                      setCoursesError(null);
                      courseService.getEnrolledCourses(user!.id, { signal })
                        .then((c) => setEnrolledCourses(c))
                        .catch((err) => {
                          if (err?.name !== 'AbortError') {
                            console.error(err);
                            setCoursesError('Failed to load your courses. Please try again.');
                          }
                        })
                        .finally(() => setLoadingCourses(false));
                    }}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : enrolledCourses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {enrolledCourses.slice(0, 2).map((course) => (
                    <CourseCard key={course.id} course={course} isEnrolled={true} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-600 mb-3">You haven't enrolled in any courses yet.</p>
                  <button
                    onClick={() => navigate('/courses')}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Browse Available Courses
                  </button>
                </div>
              )}
            </div>
          )}

          {/* For teachers/admins */}
          {(role === 'teacher' || role === 'admin' || role === 'super_admin') && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-700">Course Management</h3>
                <button
                  onClick={() => navigate('/courses')}
                  className="text-primary hover:underline text-sm"
                >
                  Manage courses →
                </button>
              </div>
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-600">
                  {role === 'teacher'
                    ? 'View and manage courses you teach'
                    : 'Create and manage all courses in the system'}
                </p>
                <button
                  onClick={() => navigate('/courses')}
                  className="mt-3 px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Go to Courses
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
