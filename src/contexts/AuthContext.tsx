// src/contexts/AuthContext.tsx
// 🔧 HOTFIX: Added timeout and better error handling for profile fetch

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
  const sessionRefreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRefreshRef = useRef<number>(0);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔧 ENHANCED: Profile fetch with timeout and better error handling
  const fetchProfile = async (userId: string): Promise<void> => {
    profileAbortRef.current?.abort();
    profileAbortRef.current = new AbortController();

    // 🔧 NEW: Add 10-second timeout for profile fetch
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Profile fetch timeout - aborting');
      profileAbortRef.current?.abort();
    }, 10000);

    try {
      console.log('Fetching profile for user:', userId);

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // Clear timeout if successful
      clearTimeout(timeoutId);

      if (!mountedRef.current) return;

      if (error) {
        console.error('Error fetching profile:', error);
        
        // 🔧 NEW: Log specific error details
        console.error('Profile fetch error details:', {
          code: (error as any).code,
          message: error.message,
          hint: (error as any).hint,
          details: (error as any).details
        });
        
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
      clearTimeout(timeoutId);
      
      if (!mountedRef.current) return;
      if (error?.name === 'AbortError') {
        console.log('Profile fetch aborted or timed out');
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

  const refreshSessionAndState = async (): Promise<boolean> => {
    try {
      console.log('🔄 Refreshing session and syncing state...');
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error || !data.session) {
        console.warn('⚠️ Session refresh failed:', error?.message);
        return false;
      }
      
      if (!mountedRef.current) return false;
      
      setSession(data.session);
      setUser(data.session.user);
      lastRefreshRef.current = Date.now();
      
      if (data.session.user.id && (!profile || profile.id !== data.session.user.id)) {
        await fetchProfile(data.session.user.id);
      }
      
      console.log('✅ Session and state refreshed successfully');
      return true;
    } catch (err) {
      console.error('❌ Session refresh error:', err);
      return false;
    }
  };

  const setupSessionRefresh = (currentSession: Session) => {
    if (sessionRefreshInterval.current) {
      clearInterval(sessionRefreshInterval.current);
    }

    sessionRefreshInterval.current = setInterval(async () => {
      if (!mountedRef.current) return;
      
      const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;
      if (timeSinceLastRefresh < 2 * 60 * 1000) {
        console.log('⏭️ Skipping refresh (too soon)');
        return;
      }
      
      await refreshSessionAndState();
    }, 3 * 60 * 1000);
  };

  useEffect(() => {
    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key?.includes('supabase.auth.token') || e.key?.includes('-auth-token')) {
        console.log('🔄 Session updated in another tab, syncing...');
        
        const { data } = await supabase.auth.getSession();
        if (data.session && mountedRef.current) {
          setSession(data.session);
          setUser(data.session.user);
          if (data.session.user.id) {
            fetchProfile(data.session.user.id);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 Page became visible');
        
        if (user && session) {
          const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
          const now = Date.now();
          const timeUntilExpiry = expiresAt - now;
          const timeSinceLastRefresh = now - lastRefreshRef.current;
          
          if (timeUntilExpiry < 10 * 60 * 1000 || timeSinceLastRefresh > 5 * 60 * 1000) {
            console.log('🔄 Tab visible: refreshing session...');
            const success = await refreshSessionAndState();
            
            if (!success) {
              console.warn('⚠️ Session refresh failed on visibility change');
              setTimeout(async () => {
                const retrySuccess = await refreshSessionAndState();
                if (!retrySuccess) {
                  console.error('❌ Session refresh failed twice, may need re-login');
                }
              }, 2000);
            }
          }
        }
        
        if (user && !profile && !loading) {
          console.log('🔄 Refreshing missing profile on page visibility...');
          fetchProfile(user.id);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, profile, loading, session]);

  // 🔧 ENHANCED: Main initialization with better timeout handling
  useEffect(() => {
    mountedRef.current = true;
    let initTimeout: ReturnType<typeof setTimeout> | undefined;

    const initializeAuth = async () => {
      try {
        console.log('AuthContext: Starting initialization...');

        // 🔧 MODIFIED: Timeout now only triggers if we're still loading
        initTimeout = setTimeout(() => {
          if (mountedRef.current && loading) {
            console.warn('⚠️ Auth initialization timed out after 30s');
            // 🔧 NEW: Don't block the app, just log it
            console.warn('⚠️ Continuing anyway - profile may be missing');
            setLoading(false);
          }
        }, 30000);

        const { data: { session }, error } = await supabase.auth.getSession();

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
          setupSessionRefresh(session);
          lastRefreshRef.current = Date.now();
          
          // 🔧 NEW: Don't let profile fetch block initialization
          fetchProfile(session.user.id).catch(err => {
            console.error('Profile fetch failed during init:', err);
          });
          
          // 🔧 NEW: Set loading to false after setting session/user
          // Profile can load in background
          setTimeout(() => {
            if (mountedRef.current) {
              setLoading(false);
            }
          }, 500); // Give profile fetch 500ms, then unblock
          
        } else {
          console.log('AuthContext: No session found');
          clearAuthState();
        }

        if (initTimeout) clearTimeout(initTimeout);
        
      } catch (error) {
        console.error('AuthContext: Error in initializeAuth:', error);
        if (!mountedRef.current) return;
        if (initTimeout) clearTimeout(initTimeout);
        clearAuthState();
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;
      console.log('Auth state changed:', event, session?.user?.email || 'no user');

      switch (event) {
        case 'SIGNED_IN':
          if (session?.user) {
            console.log('User signed in:', session.user.email);
            setSession(session);
            setUser(session.user);
            setLoading(true);
            setupSessionRefresh(session);
            lastRefreshRef.current = Date.now();
            
            // 🔧 NEW: Don't block on profile fetch
            fetchProfile(session.user.id).catch(err => {
              console.error('Profile fetch failed on sign in:', err);
            });
            
            // 🔧 NEW: Unblock after 500ms
            setTimeout(() => {
              if (mountedRef.current) setLoading(false);
            }, 500);
          }
          break;

        case 'SIGNED_OUT':
          console.log('User signed out');
          if (sessionRefreshInterval.current) {
            clearInterval(sessionRefreshInterval.current);
            sessionRefreshInterval.current = null;
          }
          clearAuthState();
          break;

        case 'TOKEN_REFRESHED':
          if (session?.user) {
            console.log('Token refreshed for:', session.user.email);
            setSession(session);
            setUser(session.user);
            lastRefreshRef.current = Date.now();
            if (!profile) {
              fetchProfile(session.user.id).catch(err => {
                console.error('Profile fetch failed on token refresh:', err);
              });
            }
          }
          break;

        case 'USER_UPDATED':
          if (session?.user) {
            console.log('User updated:', session.user.email);
            setUser(session.user);
            fetchProfile(session.user.id).catch(err => {
              console.error('Profile fetch failed on user update:', err);
            });
          }
          break;

        default:
          setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      if (initTimeout) clearTimeout(initTimeout);
      if (sessionRefreshInterval.current) {
        clearInterval(sessionRefreshInterval.current);
      }
      profileAbortRef.current?.abort();
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('Initiating sign out...');
      if (mountedRef.current) setLoading(true);

      if (sessionRefreshInterval.current) {
        clearInterval(sessionRefreshInterval.current);
        sessionRefreshInterval.current = null;
      }

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