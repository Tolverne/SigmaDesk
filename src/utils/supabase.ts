import { createClient } from '@supabase/supabase-js'

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Temporarily expose for debugging
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  (window as any).testSupabase = async () => {
    console.log('Testing Supabase connection...');
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .limit(1);
      console.log('Test result:', { data, error });
      return { data, error };
    } catch (err) {
      console.error('Test failed:', err);
      return { error: err };
    }
  };
}

console.log('✅ Supabase client created');