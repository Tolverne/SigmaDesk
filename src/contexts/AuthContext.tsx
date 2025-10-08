// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
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

/** Named hook export — matches `import { useAuth } from '../contexts/AuthContext'` */
export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mountedRef = useRef(true);
  const lastRefreshRef = useRef<number>(0);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ---------- profile fetch ----------
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!mountedRef.current) return;
      if (error) {
        console.error('[Auth] profile fetch error:', error);
        setProfile(null);
        return;
      }
      setProfile((data ?? null) as UserProfile | null);
    } catch (e) {
      if (!mountedRef.current) return;
      console.error('[Auth] profile fetch exception:', e);
      setProfile(null);
    }
  };

  // ---------- session refresh + state sync ----------
  const refreshSessionAndState = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        console.warn('[Auth] refreshSession failed:', error?.message);
        return false;
      }
      if (!mountedRef.current) return false;

      setSession(data.session);
      setUser(data.session.user);
      lastRefreshRef.current = Date.now();

      if (!profile || profile.id !== data.session.user.id) {
        await fetchProfile(data.session.user.id);
      }
      return true;
    } catch (e) {
      console.error('[Auth] refreshSession exception:', e);
      return false;
    }
  };

  const startRefreshTimer = (s: Session) => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      const since = Date.now() - lastRefreshRef.current;
      if (since < 2 * 60_000) return; // throttle
      await refreshSessionAndState();
    }, 3 * 60_000);
  };

  // ---------- initialization ----------
  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mountedRef.current) return;

        if (error) {
          console.error('[Auth] getSession error:', error);
          setUser(null);
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (data.session?.user) {
          setSession(data.session);
          setUser(data.session.user);
          lastRefreshRef.current = Date.now();
          startRefreshTimer(data.session);
          fetchProfile(data.session.user.id);
        } else {
          setUser(null);
          setSession(null);
          setProfile(null);
        }
      } catch (e) {
        console.error('[Auth] init exception:', e);
        setUser(null);
        setSession(null);
        setProfile(null);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mountedRef.current) return;
      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
          if (s?.user) {
            setSession(s);
            setUser(s.user);
            lastRefreshRef.current = Date.now();
            startRefreshTimer(s);
            fetchProfile(s.user.id);
          }
          break;
        case 'SIGNED_OUT':
          setUser(null);
          setSession(null);
          setProfile(null);
          if (refreshTimerRef.current) {
            clearInterval(refreshTimerRef.current);
            refreshTimerRef.current = null;
          }
          break;
        default:
          // no-op
          break;
      }
    });

    // cross-tab sync
    const onStorage = async (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.includes('supabase.auth.token')) {
        const { data } = await supabase.auth.getSession();
        if (!mountedRef.current) return;
        if (data.session?.user) {
          setSession(data.session);
          setUser(data.session.user);
          fetchProfile(data.session.user.id);
        } else {
          setUser(null);
          setSession(null);
          setProfile(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);

    // tab visibility: opportunistic refresh
    const onVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!session || !user) return;
      const expMs = session.expires_at ? session.expires_at * 1000 : 0;
      const msLeft = expMs - Date.now();
      const since = Date.now() - lastRefreshRef.current;
      if (msLeft < 10 * 60_000 || since > 5 * 60_000) {
        await refreshSessionAndState();
      }
      if (!profile) {
        await fetchProfile(user.id);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      sub.subscription.unsubscribe();
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- outward actions ----------
  const signOut = async () => {
    try {
      setLoading(true);
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[Auth] signOut exception:', e);
    } finally {
      if (!mountedRef.current) return;
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
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
