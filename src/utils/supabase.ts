// src/utils/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!;


console.log('[OAuth Debug] href=', window.location.href);
console.log('[OAuth Debug] has code?', new URLSearchParams(window.location.search).has('code'));
console.log('[OAuth Debug] hash starts with #access_token?', (window.location.hash || '').includes('access_token='));


console.log('🔧 Supabase config:', {
  url: supabaseUrl,
  keyExists: !!supabaseAnonKey,
  keyLength: supabaseAnonKey?.length,
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('URL:', supabaseUrl);
  console.error('Key exists:', !!supabaseAnonKey);
}

// Create Supabase client with proper session persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'supabase.auth.token', // Consistent storage key
    debug: process.env.NODE_ENV === 'development',
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
  global: {
    headers: {
      'x-client-info': 'sigmadesk-web@1.0.0',
    },
  },
  db: {
    schema: 'public',
  },
});

// ---------------------------
// Connection health monitoring
// ---------------------------
let connectionHealthy = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

export const checkSupabaseHealth = async (): Promise<boolean> => {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL && connectionHealthy) {
    return connectionHealthy;
  }

  try {
    console.log('🏥 Checking Supabase connection health...');

    const { error } = await supabase
      .from('organizations')
      .select('count')
      .limit(1)
      .single();

    connectionHealthy = !error;
    lastHealthCheck = now;

    if (connectionHealthy) {
      console.log('✅ Supabase connection healthy');
    } else {
      console.error('❌ Supabase health check failed:', error);
    }

    return connectionHealthy;
  } catch (error) {
    console.error('❌ Supabase connection unhealthy:', error);
    connectionHealthy = false;
    lastHealthCheck = now;
    return false;
  }
};

// ----------------------------------------------
// FIXED: Reset connection without clearing auth
// ----------------------------------------------
export const resetSupabaseConnection = async (): Promise<void> => {
  console.log('🔄 Resetting Supabase connection...');

  try {
    // Get current session before reset
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Only clear non-auth caches
    if (typeof window !== 'undefined') {
      // Clear service worker caches but NOT localStorage auth tokens
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
        console.log('🧹 Cleared service worker caches');
      }

      // Clear sessionStorage but preserve localStorage auth
      sessionStorage.clear();
      console.log('🧹 Cleared session storage');
    }

    // If we had a session, verify it's still valid
    if (session) {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (currentSession) {
        console.log('✅ Session preserved after reset');
      } else {
        console.warn('⚠️ Session lost during reset - may need to re-authenticate');
      }
    }

    console.log('✅ Supabase connection reset complete');
  } catch (error) {
    console.error('❌ Error resetting Supabase connection:', error);
  }
};

// ----------------------------------------------
// NEW: Session recovery helper (guarded for OAuth)
// ----------------------------------------------
export const recoverSession = async (): Promise<boolean> => {
  try {
    // Skip recovery while OAuth artifacts are present (handled by redirect handler)
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const hasPkce = search ? new URLSearchParams(search).has('code') : false;
    const hasImplicit = hash.includes('access_token=');
    if (hasPkce || hasImplicit) {
      console.log('⏭️ Skipping recoverSession while OAuth artifacts are present');
      return false;
    }

    console.log('🔄 Attempting session recovery...');
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (session && !sessionError) {
      console.log('✅ Session recovered from storage');
      return true;
    }

    const {
      data: { session: refreshedSession },
      error: refreshError,
    } = await supabase.auth.refreshSession();

    if (refreshedSession && !refreshError) {
      console.log('✅ Session recovered via refresh');
      return true;
    }

    console.warn('⚠️ No session to recover');
    return false;
  } catch (error) {
    console.error('❌ Session recovery failed:', error);
    return false;
  }
};

// ----------------------------------------------
// Debugging helpers exposed on window (dev only)
// ----------------------------------------------
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;

  (window as any).testSupabase = async () => {
    console.log('🧪 Testing Supabase connection...');

    const tests = {
      basicConnection: false,
      authSession: false,
      coursesQuery: false,
      profileQuery: false,
    };

    try {
      // Test 1: Basic connection
      const { error: orgError } = await supabase
        .from('organizations')
        .select('count')
        .limit(1);
      tests.basicConnection = !orgError;
      console.log(
        'Test 1 - Basic connection:',
        tests.basicConnection ? '✅' : '❌',
        orgError?.message
      );

      // Test 2: Auth session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      tests.authSession = !sessionError && !!sessionData.session;
      console.log(
        'Test 2 - Auth session:',
        tests.authSession ? '✅' : '❌',
        sessionError?.message
      );

      if (sessionData.session) {
        console.log('Session info:', {
          userId: sessionData.session.user.id,
          email: sessionData.session.user.email,
          expiresAt: new Date(sessionData.session.expires_at! * 1000).toISOString(),
          expiresIn: `${Math.round(
            (sessionData.session.expires_at! * 1000 - Date.now()) / 60000
          )} minutes`,
        });
      }

      // Test 3: Courses query
      const { error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .limit(3);
      tests.coursesQuery = !coursesError;
      console.log(
        'Test 3 - Courses query:',
        tests.coursesQuery ? '✅' : '❌',
        coursesError?.message
      );

      // Test 4: Profile query (if user exists)
      if (tests.authSession && sessionData.session?.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', sessionData.session.user.id)
          .maybeSingle();
        tests.profileQuery = !profileError;
        console.log(
          'Test 4 - Profile query:',
          tests.profileQuery ? '✅' : '❌',
          profileError?.message
        );
      }
    } catch (err) {
      console.error('❌ Test suite failed:', err);
    }

    console.log('📊 Test Results:', tests);
    return tests;
  };

  (window as any).resetSupabase = resetSupabaseConnection;
  (window as any).checkSupabaseHealth = checkSupabaseHealth;
  (window as any).recoverSession = recoverSession;

  // FIXED: Cache clearing that preserves auth
  (window as any).clearSupabaseCache = () => {
    if ((window as any).courseService?.clearCache) {
      (window as any).courseService.clearCache();
    }
    // Don't clear localStorage - it has auth tokens!
    console.log('🧹 Supabase cache cleared (auth preserved)');
  };

  (window as any).clearAllCaches = () => {
    console.log('🧹 Clearing all caches...');

    // Try to clear courseService cache if it exists
    if ((window as any).courseService?.clearCache) {
      (window as any).courseService.clearCache();
      console.log('✅ CourseService cache cleared');
    }

    // Clear browser caches but NOT localStorage
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    // Clear sessionStorage only
    sessionStorage.clear();

    console.log('✅ All caches cleared (auth session preserved)');
  };

  // Basic connection test
  (window as any).testConnection = async () => {
    console.log('🧪 Testing basic Supabase connection...');
    try {
      const { error } = await supabase.from('organizations').select('count').limit(1);
      if (error) {
        console.error('❌ Connection test failed:', error.message);
        return false;
      }
      console.log('✅ Connection test passed');
      return true;
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  };

  // Debug auth helper
  (window as any).debugAuth = async () => {
    const { data, error } = await supabase.auth.getSession();
    console.log('Current Session:', {
      hasSession: !!data.session,
      user: data.session?.user?.email,
      userId: data.session?.user?.id,
      expiresAt: data.session?.expires_at
        ? new Date(data.session.expires_at * 1000).toISOString()
        : null,
      expiresIn: data.session?.expires_at
        ? `${Math.round((data.session.expires_at * 1000 - Date.now()) / 1000 / 60)} minutes`
        : null,
      error: error?.message,
    });

    // Check what's in localStorage
    const storageKey = 'supabase.auth.token';
    const storedData = localStorage.getItem(storageKey);
    console.log('LocalStorage auth data exists:', !!storedData);

    return data.session;
  };

  // Force session refresh
  (window as any).forceRefresh = async () => {
    console.log('🔄 Forcing session refresh...');
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('❌ Refresh failed:', error);
      return false;
    }
    console.log('✅ Session refreshed');
    console.log(
      'New expiry:',
      data.session?.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : null
    );
    return true;
  };

  console.log('🔧 Debug functions available:');
  console.log('  - window.testSupabase()');
  console.log('  - window.debugAuth()');
  console.log('  - window.forceRefresh()');
  console.log('  - window.recoverSession()');
  console.log('  - window.clearAllCaches()');
  console.log('  - window.resetSupabase()');
}

// ----------------------------------------------
// Monitor auth state changes for debugging
// ----------------------------------------------
supabase.auth.onAuthStateChange((event, session) => {
  console.log('🔐 Auth state change:', event, {
    hasSession: !!session,
    userEmail: session?.user?.email,
    expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
  });

  if (event === 'TOKEN_REFRESHED') {
    console.log('🔄 Token refreshed successfully');
    connectionHealthy = true;
  }

  if (event === 'SIGNED_OUT') {
    console.log('👋 User signed out');
    connectionHealthy = true;
  }

  if (event === 'SIGNED_IN') {
    console.log('👋 User signed in');
    connectionHealthy = true;
  }
});

// ----------------------------------------------
// GLOBAL: Handle OAuth redirect before recovery
// ----------------------------------------------
const handleOAuthRedirectIfPresent = async (): Promise<boolean> => {
  try {
    const href = window.location.href;
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    const hasPkce = new URLSearchParams(search).has('code');
    const hasImplicit = hash.includes('access_token=');

    // PKCE takes precedence
    if (hasPkce) {
      console.log('🔐 Detected PKCE code in URL. Exchanging for session...');
      const { data, error } = await supabase.auth.exchangeCodeForSession(href);
      if (error) {
        console.error('❌ PKCE exchange failed:', error.message);
        return false;
      }
      console.log('✅ PKCE exchange complete. Session established:', !!data.session);

      // Clean the URL (remove ?code=... etc.)
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, document.title, url.toString());
      return true;
    }

    // Legacy implicit flow (hash token). No exchange needed; SDK will pick it up.
    if (hasImplicit) {
      console.log('🔐 Detected implicit token in hash. Proceeding to session check...');
      return false; // allow normal recovery afterward
    }

    return false;
  } catch (e) {
    console.error('❌ Error handling OAuth redirect:', e);
    return false;
  }
};

// ----------------------------------------------
// Initialize session handling on load (global)
// ----------------------------------------------
if (typeof window !== 'undefined') {
  window.addEventListener('load', async () => {
    console.log('🔄 Initializing Supabase session...');

    // 1) Complete OAuth redirect (PKCE) if present
    const exchanged = await handleOAuthRedirectIfPresent();

    // 2) Then attempt standard recovery/refresh
    if (!exchanged) {
      const recovered = await recoverSession();
      if (!recovered) {
        console.log('ℹ️ No existing session found');
      }
    }
  });
}
