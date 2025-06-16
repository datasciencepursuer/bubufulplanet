/**
 * Unified Session Management - SERVER SIDE ONLY
 * Consolidates device sessions (localStorage) and RLS session cookies
 * Provides a single interface for all session-related operations
 * 
 * NOTE: This file contains server-side functions only.
 * Client-side functions are in unified-session-client.ts
 */

import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

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

    // Get member details to validate session using Prisma
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId: groupIdCookie.value,
        travelerName: travelerNameCookie.value
      }
    })

    if (!member) {
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
        permissions: (member.permissions as any) || { read: true, create: false, modify: false },
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

    // Get member details for permissions using Prisma
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        travelerName
      }
    })

    if (!member) {
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
      try {
        await prisma.deviceSession.upsert({
          where: {
            deviceFingerprint
          },
          update: {
            groupId,
            travelerName,
            userAgent,
            isActive: true,
            lastUsed: new Date()
          },
          create: {
            deviceFingerprint,
            groupId,
            travelerName,
            userAgent,
            isActive: true
          }
        })
      } catch (deviceError) {
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
 * Enhanced session context for Prisma-based operations
 */
export async function withUnifiedSessionContext<T>(
  callback: (context: UnifiedSessionContext) => Promise<T>
): Promise<T> {
  const validation = await validateUnifiedSession()
  
  if (!validation.isValid || !validation.context) {
    throw new Error(validation.error || 'Unauthorized')
  }
  
  return await callback(validation.context)
}

/**
 * Unified logout - clears both cookies and device sessions
 */
export async function unifiedLogout(deviceFingerprint?: string): Promise<boolean> {
  try {
    const cookieStore = await cookies()

    // Clear session cookies
    cookieStore.delete('vacation-planner-session')
    cookieStore.delete('vacation-planner-group-id')
    cookieStore.delete('vacation-planner-traveler-name')

    // Clear device sessions if device fingerprint provided
    if (deviceFingerprint) {
      try {
        await prisma.deviceSession.updateMany({
          where: {
            deviceFingerprint,
            isActive: true
          },
          data: {
            isActive: false
          }
        })
      } catch (error) {
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

