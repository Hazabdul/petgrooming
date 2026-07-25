import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wuqimrkmntnslhnhihhw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cWltcmttbnRuc2xobmhpaGh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NzI0NTksImV4cCI6MjEwMDU0ODQ1OX0.NkOkDnrRdAhRosQVJQoUSxf9J_q82-uoUuXAo0rKAWk';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing in import.meta.env. Using fallback Supabase configuration.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

