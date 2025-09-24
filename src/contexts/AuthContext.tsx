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

  const fetchProfile = async (userId: string) => {
    try {
      console.log('🔍 Fetching profile for user:', userId);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching profile:', error);
        // If profile doesn't exist, create a default one
        if (error.code === 'PGRST116') {
          console.log('📝 Creating default profile for user');
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            const { data: newProfile, error: createError } = await supabase
              .from('user_profiles')
              .insert({
                id: userId,
                email: userData.user.email,
                first_name: userData.user.user_metadata?.first_name || null,
                last_initial: userData.user.user_metadata?.last_name?.charAt(0) || null,
                full_name: userData.user.user_metadata?.full_name || userData.user.email,
                role: 'student' // Default role
              })
              .select()
              .single();
            
            if (createError) {
              console.error('❌ Error creating profile:', createError);
              setProfile(null);
            } else {
              console.log('✅ Profile created:', newProfile);
              setProfile(newProfile);
            }
          }
        } else {
          setProfile(null);
        }
      } else {
        console.log('✅ Profile fetched:', data);
        setProfile(data);
      }
    } catch (error) {
      console.error('❌ Exception in fetchProfile:', error);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    let initTimeout: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        console.log('🔵 AuthContext: Starting initialization...');
        
        // Set a maximum timeout for initialization
        initTimeout = setTimeout(() => {
          if (mounted && loading) {
            console.warn('⚠️ Auth initialization timed out, setting loading to false');
            setLoading(false);
          }
        }, 8000); // 8 second timeout
        
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('🔴 AuthContext: Error getting session:', error);
        }
        
        if (mounted) {
          if (session) {
            console.log('✅ AuthContext: Session found:', session.user.email);
            setSession(session);
            setUser(session.user);
            await fetchProfile(session.user.id);
          } else {
            console.log('⚪ AuthContext: No session found');
            setSession(null);
            setUser(null);
            setProfile(null);
          }
          
          // Clear timeout and set loading to false
          clearTimeout(initTimeout);
          console.log('🟢 AuthContext: Setting loading to false');
          setLoading(false);
        }
      } catch (error) {
        console.error('🔴 AuthContext: Error in initializeAuth:', error);
        if (mounted) {
          clearTimeout(initTimeout);
          setLoading(false);
        }
      }
    };
    
    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.email);
      
      if (mounted) {
        // Always set loading to false when auth state changes
        setLoading(false);
        
        if (session) {
          setSession(session);
          setUser(session.user);
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await fetchProfile(session.user.id);
          }
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
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
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};