/**
 * Unified Session Management - SERVER SIDE ONLY
 * Consolidates device sessions (localStorage) and RLS session cookies
 * Provides a single interface for all session-related operations
 * 
 * NOTE: This file contains server-side functions only.
 * Client-side functions are in unified-session-client.ts
 */

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/service'

export interface UnifiedSessionContext {
  groupId: string
  travelerName: string
  role: string
  permissions: {
    read: boolean
    create: boolean
    modify: boolean
  }
  deviceFingerprint?: string
  sessionType: 'cookie' | 'device' | 'both'
}

export interface SessionValidation {
  isValid: boolean
  context?: UnifiedSessionContext
  error?: string
  requiresDeviceSetup?: boolean
}

/**
 * Server-side session validation - checks both cookies and device sessions
 */
export async function validateUnifiedSession(): Promise<SessionValidation> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('vacation-planner-session')
    const groupIdCookie = cookieStore.get('vacation-planner-group-id')
    const travelerNameCookie = cookieStore.get('vacation-planner-traveler-name')

    // Check if we have basic session cookies
    if (!sessionCookie?.value || !groupIdCookie?.value || !travelerNameCookie?.value) {
      return { 
        isValid: false, 
        error: 'No session cookies found',
        requiresDeviceSetup: true 
      }
    }

    // Validate session format
    if (!sessionCookie.value.startsWith('group-')) {
      return { 
        isValid: false, 
        error: 'Invalid session format' 
      }
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
      return { 
        isValid: false, 
        error: 'Member not found or invalid' 
      }
    }

    return {
      isValid: true,
      context: {
        groupId: groupIdCookie.value,
        travelerName: travelerNameCookie.value,
        role: member.role,
        permissions: member.permissions || { read: true, create: false, modify: false },
        sessionType: 'cookie'
      }
    }
  } catch (error) {
    console.error('Session validation error:', error)
    return { 
      isValid: false, 
      error: 'Session validation failed' 
    }
  }
}

/**
 * Create unified session with both cookies and device tracking
 */
export async function createUnifiedSession(
  groupId: string, 
  travelerName: string,
  deviceFingerprint?: string,
  userAgent?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cookieStore = await cookies()
    const supabase = createServiceClient()

    // Get member details for permissions
    const { data: member, error: memberError } = await supabase
      .from('group_members')
      .select('role, permissions')
      .eq('group_id', groupId)
      .eq('traveler_name', travelerName)
      .single()

    if (memberError || !member) {
      return { success: false, error: 'Member not found' }
    }

    // Create session ID
    const sessionId = `group-${groupId}-${Date.now()}`
    
    // Set session cookies (for RLS)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    }

    cookieStore.set('vacation-planner-session', sessionId, cookieOptions)
    cookieStore.set('vacation-planner-group-id', groupId, cookieOptions)
    cookieStore.set('vacation-planner-traveler-name', travelerName, cookieOptions)

    // Save device session if device info provided
    if (deviceFingerprint) {
      const { error: deviceError } = await supabase.rpc('refresh_device_session', {
        p_device_fingerprint: deviceFingerprint,
        p_group_id: groupId,
        p_traveler_name: travelerName,
        p_user_agent: userAgent,
        p_ip_address: '127.0.0.1' // Will be overridden by actual request
      })

      if (deviceError) {
        console.warn('Failed to save device session:', deviceError)
        // Don't fail the entire session creation for device session issues
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to create unified session:', error)
    return { success: false, error: 'Session creation failed' }
  }
}

/**
 * Enhanced session context with RLS variable setting
 */
export async function withUnifiedSessionContext<T>(
  callback: (context: UnifiedSessionContext, supabase: any) => Promise<T>
): Promise<T> {
  const validation = await validateUnifiedSession()
  
  if (!validation.isValid || !validation.context) {
    throw new Error(validation.error || 'Unauthorized')
  }

  // Create RLS-enabled client with session context
  const supabase = await createRLSClient(validation.context.groupId, validation.context.travelerName)
  
  return await callback(validation.context, supabase)
}

/**
 * Create Supabase client with RLS session variables set
 */
async function createRLSClient(groupId: string, travelerName: string) {
  const cookieStore = await cookies()
  
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
  const { error: groupError } = await supabase.rpc('set_session_variable', {
    variable_name: 'app.current_group_id',
    variable_value: groupId
  })
  
  const { error: travelerError } = await supabase.rpc('set_session_variable', {
    variable_name: 'app.current_traveler_name', 
    variable_value: travelerName
  })
  
  const error = groupError || travelerError
  
  if (error) {
    console.error('Failed to set RLS session context:', error)
    throw new Error('Failed to set session context')
  }
  
  return supabase
}

/**
 * Unified logout - clears both cookies and device sessions
 */
export async function unifiedLogout(deviceFingerprint?: string): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const supabase = createServiceClient()

    // Clear session cookies
    cookieStore.delete('vacation-planner-session')
    cookieStore.delete('vacation-planner-group-id')
    cookieStore.delete('vacation-planner-traveler-name')

    // Clear device sessions if device fingerprint provided
    if (deviceFingerprint) {
      const { error } = await supabase
        .from('device_sessions')
        .update({ is_active: false })
        .eq('device_fingerprint', deviceFingerprint)

      if (error) {
        console.warn('Failed to clear device sessions:', error)
        // Don't fail logout for device session issues
      }
    }

    return true
  } catch (error) {
    console.error('Logout error:', error)
    return false
  }
}

/**
 * Check permission with unified context
 */
export function requireUnifiedPermission(
  context: UnifiedSessionContext, 
  permission: keyof UnifiedSessionContext['permissions']
) {
  if (!context.permissions[permission]) {
    throw new Error(`Insufficient permissions: ${permission} required`)
  }
}

