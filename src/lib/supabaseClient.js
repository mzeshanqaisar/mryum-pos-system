import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-ref') &&
    !supabaseAnonKey.includes('your-anon-public-key'),
)

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] Missing or placeholder credentials. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then restart the dev server.',
  )
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-anon-key')
