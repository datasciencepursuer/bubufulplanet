import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const groupId = cookieStore.get('vacation-planner-group-id')?.value
    const travelerName = cookieStore.get('vacation-planner-traveler-name')?.value

    // Get device fingerprint from request body if provided
    let deviceFingerprint: string | undefined
    try {
      const body = await request.json()
      deviceFingerprint = body.deviceFingerprint
    } catch {
      // Body parsing failed, continue without device fingerprint
    }

    // If we have device info, remove the device session
    if (deviceFingerprint && groupId && travelerName) {
      const supabase = createServiceClient()
      
      try {
        // Mark the device session as inactive instead of deleting it
        // This preserves the session but prevents auto-login
        await supabase
          .from('device_sessions')
          .update({ is_active: false })
          .eq('device_fingerprint', deviceFingerprint)
          .eq('group_id', groupId)
          .eq('traveler_name', travelerName)
      } catch (error) {
        console.error('Failed to deactivate device session:', error)
        // Don't fail the logout if device session cleanup fails
      }
    }
    
    // Clear all group-based session cookies
    cookieStore.delete('vacation-planner-session')
    cookieStore.delete('vacation-planner-group-id')
    cookieStore.delete('vacation-planner-traveler-name')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}