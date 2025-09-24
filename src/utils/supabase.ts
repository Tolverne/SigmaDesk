import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!

console.log('🔧 Supabase config:', {
  url: supabaseUrl,
  keyExists: !!supabaseAnonKey,
  keyLength: supabaseAnonKey?.length
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('URL:', supabaseUrl);
  console.error('Key exists:', !!supabaseAnonKey);
}

// Create Supabase client with improved configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 2 // Limit realtime events to prevent overload
    }
  },
  global: {
    headers: {
      'x-client-info': 'sigmadesk-web@1.0.0'
    }
  }
});

// Connection health monitoring
let connectionHealthy = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

export const checkSupabaseHealth = async (): Promise<boolean> => {
  const now = Date.now();
  
  // Don't check too frequently
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
    
    connectionHealthy = true;
    lastHealthCheck = now;
    console.log('✅ Supabase connection healthy');
    return true;
    
  } catch (error) {
    console.error('❌ Supabase connection unhealthy:', error);
    connectionHealthy = false;
    lastHealthCheck = now;
    return false;
  }
};

// Reset connection helper
export const resetSupabaseConnection = async (): Promise<void> => {
  console.log('🔄 Resetting Supabase connection...');
  
  try {
    // Sign out to clear any bad session state
    await supabase.auth.signOut();
    
    // Clear any cached data
    if (typeof window !== 'undefined') {
      // Clear auth tokens
      localStorage.removeItem('sb-' + supabaseUrl.split('//')[1].split('.')[0] + '-auth-token');
      sessionStorage.clear();
    }
    
    // Force a fresh session check
    await supabase.auth.getSession();
    
    console.log('✅ Supabase connection reset complete');
  } catch (error) {
    console.error('❌ Error resetting Supabase connection:', error);
  }
};

// Enhanced testing function
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  
  (window as any).testSupabase = async () => {
    console.log('🧪 Testing Supabase connection...');
    
    const tests = {
      basicConnection: false,
      authSession: false,
      coursesQuery: false,
      profileQuery: false
    };
    
    try {
      // Test 1: Basic connection
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('count')
        .limit(1);
      tests.basicConnection = !orgError;
      console.log('Test 1 - Basic connection:', tests.basicConnection ? '✅' : '❌', orgError?.message);
      
      // Test 2: Auth session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      tests.authSession = !sessionError && !!sessionData.session;
      console.log('Test 2 - Auth session:', tests.authSession ? '✅' : '❌', sessionError?.message);
      
      // Test 3: Courses query
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .limit(3);
      tests.coursesQuery = !coursesError;
      console.log('Test 3 - Courses query:', tests.coursesQuery ? '✅' : '❌', coursesError?.message);
      
      // Test 4: Profile query (if user exists)
      if (tests.authSession && sessionData.session?.user) {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', sessionData.session.user.id)
          .maybeSingle();
        tests.profileQuery = !profileError;
        console.log('Test 4 - Profile query:', tests.profileQuery ? '✅' : '❌', profileError?.message);
        console.log('Profile data:', profileData);
      }
      
    } catch (err) {
      console.error('❌ Test suite failed:', err);
    }
    
    console.log('📊 Test Results:', tests);
    return tests;
  };
  
  (window as any).resetSupabase = resetSupabaseConnection;
  (window as any).checkSupabaseHealth = checkSupabaseHealth;
  
  // Add cache clearing function
  (window as any).clearSupabaseCache = () => {
    if ((window as any).courseService?.clearCache) {
      (window as any).courseService.clearCache();
    }
    console.log('🧹 Supabase cache cleared');
  };
}

// Monitor auth state changes for debugging
supabase.auth.onAuthStateChange((event, session) => {
  console.log('🔐 Auth state change:', event, {
    hasSession: !!session,
    userEmail: session?.user?.email,
    expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
  });
  
  if (event === 'TOKEN_REFRESHED') {
    console.log('🔄 Token refreshed successfully');
    connectionHealthy = true; // Reset health status on successful token refresh
  }
  
  if (event === 'SIGNED_OUT') {
    console.log('👋 User signed out, clearing health status');
    connectionHealthy = true; // Reset health status on sign out
  }
});

// Periodic health check in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    checkSupabaseHealth();
  }, 60000); // Check every minute in development
}
// Add this to the end of your existing supabase.ts file, 
// after the existing window debugging functions

// Simple debug functions without dynamic imports
if (typeof window !== 'undefined') {
    // Add cache clearing function that works with any courseService
    (window as any).clearAllCaches = () => {
      console.log('🧹 Clearing all caches...');
      
      // Try to clear courseService cache if it exists
      if ((window as any).courseService?.clearCache) {
        (window as any).courseService.clearCache();
        console.log('✅ CourseService cache cleared');
      }
      
      // Clear any other browser caches
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }
      
      console.log('✅ All caches cleared');
    };
    
    // Add basic connection test
    (window as any).testConnection = async () => {
      console.log('🧪 Testing basic Supabase connection...');
      try {
        const { data, error } = await supabase.from('organizations').select('count').limit(1);
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
    
    console.log('🔧 Debug functions available: window.clearAllCaches(), window.testConnection()');
  }