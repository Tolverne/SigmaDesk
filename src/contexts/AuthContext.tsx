import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_initial: string | null;
  full_name: string;
  role: 'student' | 'teacher' | 'admin' | 'super_admin';
  organization_id: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mountedRef = useRef(true);
  const profileAbortRef = useRef<AbortController | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<void> => {
    profileAbortRef.current?.abort();
    profileAbortRef.current = new AbortController();

    try {
      console.log('Fetching profile for user:', userId);

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
        return;
      }

      if (data) {
        console.log('Profile fetched successfully:', data.email, data.role);
        setProfile(data as UserProfile);
      } else {
        console.log('No profile found for user');
        setProfile(null);
      }
    } catch (error: any) {
      if (!mountedRef.current) return;
      if (error?.name === 'AbortError') {
        console.log('Profile fetch aborted');
        return;
      }
      console.error('Exception in fetchProfile:', error);
      setProfile(null);
    }
  };

  const clearAuthState = () => {
    console.log('Clearing auth state...');
    if (!mountedRef.current) return;
    setUser(null);
    setProfile(null);
    setSession(null);
    setLoading(false);
  };

  useEffect(() => {
    mountedRef.current = true;
    let initTimeout: ReturnType<typeof setTimeout> | undefined;

    const initializeAuth = async () => {
      try {
        console.log('AuthContext: Starting initialization...');

        initTimeout = setTimeout(() => {
          if (mountedRef.current && loading) {
            console.warn('Auth initialization timed out');
            setLoading(false);
          }
        }, 15000);

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mountedRef.current) return;

        if (error) {
          console.error('AuthContext: Error getting session:', error);
          clearAuthState();
          return;
        }

        if (session?.user) {
          console.log('AuthContext: Session found for:', session.user.email);
          setSession(session);
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          console.log('AuthContext: No session found');
          clearAuthState();
        }

        if (initTimeout) clearTimeout(initTimeout);
        setLoading(false);
      } catch (error) {
        console.error('AuthContext: Error in initializeAuth:', error);
        if (!mountedRef.current) return;
        if (initTimeout) clearTimeout(initTimeout);
        clearAuthState();
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;
      console.log('Auth state changed:', event, session?.user?.email || 'no user');

      switch (event) {
        case 'SIGNED_IN':
          if (session?.user) {
            console.log('User signed in:', session.user.email);
            setSession(session);
            setUser(session.user);
            setLoading(true);
            await fetchProfile(session.user.id);
            if (mountedRef.current) setLoading(false);
          }
          break;

        case 'SIGNED_OUT':
          console.log('User signed out');
          clearAuthState();
          break;

        case 'TOKEN_REFRESHED':
          if (session?.user) {
            console.log('Token refreshed for:', session.user.email);
            setSession(session);
            setUser(session.user);
            if (!profile) {
              await fetchProfile(session.user.id);
            }
          }
          break;

        default:
          setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      if (initTimeout) clearTimeout(initTimeout);
      profileAbortRef.current?.abort();
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('Initiating sign out...');
      if (mountedRef.current) setLoading(true);

      clearAuthState();

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Error signing out:', error);
      } else {
        console.log('Successfully signed out');
      }

      if (typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.clear();
      }
    } catch (error) {
      console.error('Exception during sign out:', error);
    } finally {
      clearAuthState();
    }
  };

  const refreshProfile = async () => {
    if (user) {
      console.log('Refreshing profile for:', user.email);
      await fetchProfile(user.id);
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};