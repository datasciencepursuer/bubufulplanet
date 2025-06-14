import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  try {
    const { accessCode, travelerName, deviceFingerprint }: { 
      accessCode: string; 
      travelerName: string;
      deviceFingerprint?: string;
    } = await request.json()

    if (!accessCode?.trim()) {
      return NextResponse.json({ error: 'Access code is required' }, { status: 400 })
    }

    if (!travelerName?.trim()) {
      return NextResponse.json({ error: 'Traveler name is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Find the group by access code
    const { data: group, error: groupError } = await supabase
      .from('travel_groups')
      .select('id, name, access_code')
      .eq('access_code', accessCode.trim().toUpperCase())
      .single()

    if (groupError || !group) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 401 })
    }

    // Check if the traveler name exists in this group
    const { data: member, error: memberError } = await supabase
      .from('group_members')
      .select('traveler_name, role, permissions')
      .eq('group_id', group.id)
      .eq('traveler_name', travelerName.trim())
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: 'Traveler name not found in this group' }, { status: 401 })
    }

    // Authentication successful - set session cookies
    const sessionId = `group-${group.id}-${Date.now()}`
    
    const cookieStore = await cookies()
    cookieStore.set('vacation-planner-session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })
    
    cookieStore.set('vacation-planner-group-id', group.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })
    
    cookieStore.set('vacation-planner-traveler-name', travelerName.trim(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    // Save device session if fingerprint provided
    if (deviceFingerprint) {
      try {
        const userAgent = request.headers.get('user-agent') || 'unknown'
        const forwardedFor = request.headers.get('x-forwarded-for')
        const realIp = request.headers.get('x-real-ip')
        const ip = forwardedFor?.split(',')[0] || realIp || '127.0.0.1'

        // First, deactivate any existing sessions for this device
        await supabase
          .from('device_sessions')
          .update({ is_active: false })
          .eq('device_fingerprint', deviceFingerprint)
          .eq('is_active', true)

        // Then create/update the session for the current group
        await supabase.rpc('refresh_device_session', {
          p_device_fingerprint: deviceFingerprint,
          p_group_id: group.id,
          p_traveler_name: travelerName.trim(),
          p_user_agent: userAgent,
          p_ip_address: ip
        })
      } catch (error) {
        // Don't fail the login if device session save fails
        console.error('Failed to save device session:', error)
      }
    }

    return NextResponse.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        accessCode: group.access_code
      },
      currentMember: {
        name: member.traveler_name,
        role: member.role,
        permissions: member.permissions
      }
    })

  } catch (error) {
    console.error('Error in group join:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}