import { cookies } from 'next/headers'
import { createServiceClient } from './service'
import { createClient } from './server'

export interface SessionContext {
  groupId: string
  travelerName: string
  role: string
  permissions: {
    read: boolean
    create: boolean
    modify: boolean
  }
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('vacation-planner-session')
  const groupIdCookie = cookieStore.get('vacation-planner-group-id')
  const travelerNameCookie = cookieStore.get('vacation-planner-traveler-name')

  if (!sessionCookie?.value || !groupIdCookie?.value || !travelerNameCookie?.value) {
    return null
  }

  // Validate session format
  if (!sessionCookie.value.startsWith('group-')) {
    return null
  }

  const supabase = createServiceClient()
  
  // Get member details to validate session
  const { data: member, error } = await supabase
    .from('group_members')
    .select('traveler_name, role, permissions')
    .eq('group_id', groupIdCookie.value)
    .eq('traveler_name', travelerNameCookie.value)
    .single()

  if (error || !member) {
    return null
  }

  return {
    groupId: groupIdCookie.value,
    travelerName: travelerNameCookie.value,
    role: member.role,
    permissions: member.permissions || { read: true, create: false, modify: false }
  }
}

export async function withSessionContext<T>(
  callback: (context: SessionContext, supabase: any) => Promise<T>
): Promise<T> {
  const context = await getSessionContext()
  if (!context) {
    throw new Error('Unauthorized')
  }

  // Use service client but manually enforce group isolation in queries
  const supabase = createServiceClient()
  
  return await callback(context, supabase)
}

// Helper to create group-scoped queries
export function withGroupFilter(query: any, groupId: string) {
  return query.eq('group_id', groupId)
}

export function requirePermission(context: SessionContext, permission: keyof SessionContext['permissions']) {
  if (!context.permissions[permission]) {
    throw new Error(`Insufficient permissions: ${permission} required`)
  }
}