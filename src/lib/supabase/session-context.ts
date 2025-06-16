import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Sets session context variables for RLS policies
 * Must be called before any database operations in API routes
 */
export async function setSessionContext(groupId?: string, travelerName?: string) {
  const cookieStore = cookies()
  
  // Get values from parameters or cookies
  const sessionGroupId = groupId || cookieStore.get('vacation-planner-group-id')?.value
  const sessionTravelerName = travelerName || cookieStore.get('vacation-planner-traveler-name')?.value
  
  if (!sessionGroupId || !sessionTravelerName) {
    throw new Error('Session context missing: group_id and traveler_name required')
  }
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )
  
  // Set session variables for RLS policies
  const { error } = await supabase.rpc('exec', {
    sql: `
      SET SESSION app.current_group_id = '${sessionGroupId}';
      SET SESSION app.current_traveler_name = '${sessionTravelerName}';
    `
  })
  
  if (error) {
    console.error('Failed to set session context:', error)
    throw new Error('Failed to set session context')
  }
  
  return { groupId: sessionGroupId, travelerName: sessionTravelerName }
}

/**
 * Creates a Supabase client with session context already set
 * Use this instead of creating clients manually in API routes
 */
export async function createSessionClient(groupId?: string, travelerName?: string) {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )
  
  // Set session context
  await setSessionContext(groupId, travelerName)
  
  return supabase
}

/**
 * Gets current session info from cookies
 */
export function getSessionInfo() {
  const cookieStore = cookies()
  
  return {
    groupId: cookieStore.get('vacation-planner-group-id')?.value,
    travelerName: cookieStore.get('vacation-planner-traveler-name')?.value
  }
}