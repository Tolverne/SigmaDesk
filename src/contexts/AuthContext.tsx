import React, { createContext, useContext, useState, useEffect } from 'react';
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
  hasRLSIssue: boolean;
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasRLSIssue, setHasRLSIssue] = useState(false);

  const isRLSError = (error: any): boolean => {
    return error?.code === '42P17' || // Infinite recursion
           error?.message?.includes('infinite recursion') ||
           error?.message?.includes('policy') ||
           (error?.message?.includes('500') && error?.message?.includes('user_profiles'));
  };

  const fetchProfile = async (userId: string, retryCount = 0): Promise<void> => {
    try {
      console.log('🔍 Fetching profile for user:', userId, 'Retry:', retryCount);
      
      // If we've detected RLS issues, try a different approach
      if (hasRLSIssue || retryCount > 0) {
        console.log('⚠️ Using RLS bypass approach for profile fetch');
        
        // Try using the auth admin functions or service role if available
        // For now, create a minimal profile from user metadata
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const fallbackProfile: UserProfile = {
            id: userId,
            email: userData.user.email || '',
            first_name: userData.user.user_metadata?.first_name || null,
            last_initial: userData.user.user_metadata?.last_name?.charAt(0) || null,
            full_name: userData.user.user_metadata?.full_name || userData.user.email || 'User',
            role: 'student', // Default role when we can't fetch from DB
            organization_id: null
          };
          
          console.log('🛡️ Using fallback profile due to RLS issues:', fallbackProfile);
          setProfile(fallbackProfile);
          return;
        }
      }

      // Try normal profile fetch with RLS error handling
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching profile:', error);
        
        // Check if it's an RLS infinite recursion error
        if (isRLSError(error)) {
          console.error('🚨 RLS infinite recursion detected!');
          setHasRLSIssue(true);
          
          // Show user-friendly message about database issues
          if (process.env.NODE_ENV === 'development') {
            console.error('🔧 DATABASE ISSUE DETECTED:');
            console.error('   The user_profiles table has a Row Level Security policy');
            console.error('   that creates infinite recursion. This needs to be fixed in Supabase.');
            console.error('   Common causes:');
            console.error('   - Policy references auth.uid() and queries user_profiles');
            console.error('   - Policy has circular dependencies');
            console.error('   - Policy uses functions that query the same table');
          }
          
          // Use fallback profile creation
          return fetchProfile(userId, 1);
        }
        
        // Handle other errors (like missing profile)
        if (error.code === 'PGRST116' && retryCount === 0) {
          console.log('📝 Profile not found, user will need admin help or policy fix');
          setProfile(null);
          return;
        }
        
        console.warn('⚠️ Could not fetch profile:', error.message);
        setProfile(null);
        return;
      }

      if (data) {
        console.log('✅ Profile fetched successfully:', data.email, data.role);
        setProfile(data);
        setHasRLSIssue(false); // Reset RLS issue flag on success
      } else {
        console.log('📝 No profile found for user');
        setProfile(null);
      }
      
    } catch (error) {
      console.error('❌ Exception in fetchProfile:', error);
      
      if (isRLSError(error)) {
        setHasRLSIssue(true);
        if (retryCount === 0) {
          return fetchProfile(userId, 1); // Retry with fallback
        }
      }
      
      setProfile(null);
    }
  };

  // Clear all auth state
  const clearAuthState = () => {
    console.log('🧹 Clearing auth state...');
    setUser(null);
    setProfile(null);
    setSession(null);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    let initTimeout: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        console.log('🔵 AuthContext: Starting initialization...');
        
        // Set a timeout for initialization
        initTimeout = setTimeout(() => {
          if (mounted && loading) {
            console.warn('⚠️ Auth initialization timed out');
            if (mounted) {
              setLoading(false);
            }
          }
        }, 15000); // 15 second timeout
        
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('🔴 AuthContext: Error getting session:', error);
          if (mounted) {
            clearAuthState();
          }
          return;
        }
        
        if (mounted) {
          if (session?.user) {
            console.log('✅ AuthContext: Session found for:', session.user.email);
            setSession(session);
            setUser(session.user);
            
            // Fetch profile with RLS error handling
            try {
              await fetchProfile(session.user.id);
            } catch (profileError) {
              console.error('❌ Profile fetch failed:', profileError);
              // Continue without profile - user can still access basic functionality
            }
          } else {
            console.log('⚪ AuthContext: No session found');
            clearAuthState();
          }
          
          clearTimeout(initTimeout);
          setLoading(false);
        }
      } catch (error) {
        console.error('🔴 AuthContext: Error in initializeAuth:', error);
        if (mounted) {
          clearTimeout(initTimeout);
          clearAuthState();
        }
      }
    };
    
    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.email || 'no user');
      
      if (!mounted) return;

      // Handle different auth events
      switch (event) {
        case 'SIGNED_IN':
          if (session?.user) {
            console.log('✅ User signed in:', session.user.email);
            setSession(session);
            setUser(session.user);
            setLoading(true);
            try {
              await fetchProfile(session.user.id);
            } catch (profileError) {
              console.error('❌ Profile fetch failed on sign in:', profileError);
            }
            setLoading(false);
          }
          break;
          
        case 'SIGNED_OUT':
          console.log('👋 User signed out');
          setHasRLSIssue(false); // Reset RLS flag
          clearAuthState();
          break;
          
        case 'TOKEN_REFRESHED':
          if (session?.user) {
            console.log('🔄 Token refreshed for:', session.user.email);
            setSession(session);
            setUser(session.user);
            // Don't re-fetch profile on token refresh if we already have it
            if (!profile && !hasRLSIssue) {
              try {
                await fetchProfile(session.user.id);
              } catch (profileError) {
                console.error('❌ Profile fetch failed on token refresh:', profileError);
              }
            }
          }
          break;
          
        default:
          setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(initTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('👋 Initiating sign out...');
      setLoading(true);
      
      // Clear state immediately
      clearAuthState();
      setHasRLSIssue(false);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Error signing out:', error);
      } else {
        console.log('✅ Successfully signed out');
      }
      
      // Clear storage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.clear();
      }
      
    } catch (error) {
      console.error('❌ Exception during sign out:', error);
    } finally {
      clearAuthState();
    }
  };

  const refreshProfile = async () => {
    if (user) {
      console.log('🔄 Refreshing profile for:', user.email);
      setHasRLSIssue(false); // Reset RLS flag before retry
      await fetchProfile(user.id);
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signOut,
    refreshProfile,
    hasRLSIssue
  };

  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('🐛 AuthContext State:', {
      hasUser: !!user,
      userEmail: user?.email,
      hasProfile: !!profile,
      profileRole: profile?.role,
      loading,
      sessionValid: !!session,
      hasRLSIssue
    });
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};