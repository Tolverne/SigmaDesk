import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Prevent multiple navigations (SIGNED_IN + hash handler + user effect)
  const navigatedRef = useRef(false);

  // Centralized post-login check: only allow active users to proceed
  const checkActiveAndNavigate = async () => {
    if (navigatedRef.current) return;

    const { data: authUser } = await supabase.auth.getUser();
    const uid = authUser?.user?.id;
    if (!uid) return;

    const { data: profile, error: profErr } = await supabase
      .from('user_profiles')
      .select('id, is_active')
      .eq('id', uid)
      .maybeSingle();

    if (profErr) {
      // Fall back to dashboard; RLS will still protect resources
      console.warn('[Login] profile fetch failed; proceeding anyway:', profErr.message);
      navigatedRef.current = true;
      navigate('/dashboard', { replace: true });
      return;
    }

    if (!profile?.is_active) {
      await supabase.auth.signOut();
      setErrorMsg('Your account is not activated yet. Please ask an admin for an invite.');
      return;
    }

    navigatedRef.current = true;
    navigate('/dashboard', { replace: true });
  };

  // 1) If already logged in (AuthProvider has a session), check active → navigate
  useEffect(() => {
    if (!loading && user && !navigatedRef.current) {
      checkActiveAndNavigate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  // 2) Handle OAuth callback heuristics (implicit flow hash or PKCE code)
  useEffect(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const hasImplicit = hash.includes('access_token=');
    const hasPkce = new URLSearchParams(search).has('code');

    if ((hasImplicit || hasPkce) && !navigatedRef.current) {
      const t = setTimeout(() => {
        // After Supabase finalizes the session, run the same active check
        checkActiveAndNavigate();
      }, 150);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3) Backup: on real-time auth state change while on this page
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' && !navigatedRef.current) {
        checkActiveAndNavigate();
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 const handleGoogleLogin = async () => {
   try {
     setIsLoggingIn(true);
     setErrorMsg(null);
     const redirectTo = `${window.location.origin}/`;
     const { error } = await supabase.auth.signInWithOAuth({
       provider: 'google',
       options: {
         redirectTo, // return to '/'
         queryParams: { access_type: 'offline', prompt: 'consent' },
       },
     });
     if (error) throw error;
   } catch (error: any) {
     console.error('Google login error:', error);
     setErrorMsg(error?.message || 'Unknown Google login error.');
     setIsLoggingIn(false);
   }
 };

 const handleMicrosoftLogin = async () => {
   try {
     setIsLoggingIn(true);
     setErrorMsg(null);
     const redirectTo = `${window.location.origin}/`;
     const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
       options: {
        // either let Supabase use your Site URL OR add redirectTo: `${window.location.origin}/`
       scopes: 'email', // 👈 REQUIRED so Supabase receives an email
       },
     });
     if (error) throw error;
   } catch (error: any) {
     console.error('Microsoft login error:', error);
     setErrorMsg(error?.message || 'Unknown Microsoft login error.');
     setIsLoggingIn(false);
   }
 };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-io-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-io-primary to-io-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary mb-2">Σ IO Education</h1>
            <p className="text-gray-600 italic">Where Every Step Counts</p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded bg-red-50 text-sm text-red-700 border border-red-200">
              {errorMsg}
            </div>
          )}

          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full px-4 py-3 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{isLoggingIn ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>

          {/* Microsoft */}
          <button
            onClick={handleMicrosoftLogin}
            disabled={isLoggingIn}
            className="mt-3 w-full px-4 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {/* Simple MS logo: 4 squares */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="9" height="9" fill="white" />
              <rect x="13" y="2" width="9" height="9" fill="white" />
              <rect x="2" y="13" width="9" height="9" fill="white" />
              <rect x="13" y="13" width="9" height="9" fill="white" />
            </svg>
            <span>{isLoggingIn ? 'Signing in...' : 'Sign in with Microsoft'}</span>
          </button>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>For demo purposes, you'll be assigned a student role.</p>
            <p className="mt-2">Contact admin to change roles.</p>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-2 bg-gray-100 rounded text-xs text-gray-600">
              <p>Current origin: {window.location.origin}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
