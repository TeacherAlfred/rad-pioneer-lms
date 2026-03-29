import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables are MISSING! Check your .env.local file.")
}

// createBrowserClient automatically handles singleton patterns and 
// cookie persistence for Next.js client components.
export const supabase = createBrowserClient(
  supabaseUrl || '', 
  supabaseAnonKey || ''
)