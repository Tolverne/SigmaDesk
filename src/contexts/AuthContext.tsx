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

  const fetchProfile = async (userId: string, retryCount = 0): Promise<void> => {
    try {
      console.log('🔍 Fetching profile for user:', userId, 'Retry:', retryCount);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors

      if (error) {
        console.error('❌ Error fetching profile:', error);
        
        // If profile doesn't exist and this is first attempt, try to create it
        if (error.code === 'PGRST116' && retryCount === 0) {
          console.log('📝 Profile not found, attempting to create...');
          await createDefaultProfile(userId);
          // Retry once after creation
          return fetchProfile(userId, 1);
        }
        
        console.warn('⚠️ Could not fetch/create profile, proceeding without profile');
        setProfile(null);
        return;
      }

      if (data) {
        console.log('✅ Profile fetched successfully:', data.email, data.role);
        setProfile(data);
      } else {
        // No profile found, try to create one (first attempt only)
        if (retryCount === 0) {
          console.log('📝 No profile data, attempting to create...');
          await createDefaultProfile(userId);
          return fetchProfile(userId, 1);
        } else {
          console.warn('⚠️ No profile found after creation attempt');
          setProfile(null);
        }
      }
    } catch (error) {
      console.error('❌ Exception in fetchProfile:', error);
      setProfile(null);
    }
  };

  const createDefaultProfile = async (userId: string): Promise<void> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        console.error('❌ No user data available for profile creation');
        return;
      }

      const profileData = {
        id: userId,
        email: userData.user.email || '',
        first_name: userData.user.user_metadata?.first_name || null,
        last_initial: userData.user.user_metadata?.last_name?.charAt(0) || null,
        full_name: userData.user.user_metadata?.full_name || userData.user.email || '',
        role: 'student' as const
      };

      console.log('📝 Creating profile with data:', profileData);

      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert(profileData)
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Error creating profile:', createError);
        // If it's a permissions error, log it but don't throw
        if (createError.code === '42501' || createError.code === 'PGRST301') {
          console.warn('⚠️ Insufficient permissions to create profile. Admin intervention required.');
        }
      } else {
        console.log('✅ Profile created successfully:', newProfile);
      }
    } catch (error) {
      console.error('❌ Exception in createDefaultProfile:', error);
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
        }, 10000); // 10 second timeout
        
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
            // Fetch profile with error handling
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
            setLoading(true); // Set loading while fetching profile
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
          clearAuthState();
          break;
          
        case 'TOKEN_REFRESHED':
          if (session?.user) {
            console.log('🔄 Token refreshed for:', session.user.email);
            setSession(session);
            setUser(session.user);
            // Don't re-fetch profile on token refresh if we already have it
            if (!profile) {
              try {
                await fetchProfile(session.user.id);
              } catch (profileError) {
                console.error('❌ Profile fetch failed on token refresh:', profileError);
              }
            }
          }
          break;
          
        case 'PASSWORD_RECOVERY':
        case 'USER_UPDATED':
          // Handle these events if needed
          break;
          
        default:
          // For any other events, ensure loading is false
          setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(initTimeout);
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - only run once

  const signOut = async () => {
    try {
      console.log('👋 Initiating sign out...');
      setLoading(true);
      
      // Clear state immediately for better UX
      clearAuthState();
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Error signing out:', error);
        // Even if there's an error, we've cleared local state
      } else {
        console.log('✅ Successfully signed out');
      }
      
      // Clear any cached data
      if (typeof window !== 'undefined') {
        // Clear any localStorage items if you're using them
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.clear();
      }
      
    } catch (error) {
      console.error('❌ Exception during sign out:', error);
    } finally {
      // Ensure loading is false and state is clear
      clearAuthState();
    }
  };

  const refreshProfile = async () => {
    if (user) {
      console.log('🔄 Refreshing profile for:', user.email);
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
  };

  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('🐛 AuthContext State:', {
      hasUser: !!user,
      userEmail: user?.email,
      hasProfile: !!profile,
      profileRole: profile?.role,
      loading,
      sessionValid: !!session
    });
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};