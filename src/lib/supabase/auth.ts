import { createClient } from '@supabase/supabase-js'
import { DEFAULT_USER_ID } from '@/lib/constants'

// Create a special client that bypasses RLS for server operations
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key bypasses RLS
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Create an authenticated client with the default user
export async function createAuthenticatedClient() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  // Sign in as the default user
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'default@vacation-planner.local',
    password: 'not-a-real-password',
  })

  if (error) {
    console.error('Failed to sign in as default user:', error)
    // Return the service client as fallback
    return createServiceClient()
  }

  return supabase
}