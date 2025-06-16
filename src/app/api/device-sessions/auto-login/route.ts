import { NextRequest, NextResponse } from 'next/server'
import { createUnifiedSession } from '@/lib/unified-session'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceFingerprint, groupId, travelerName } = body

    if (!deviceFingerprint || !groupId || !travelerName) {
      return NextResponse.json(
        { error: 'Device fingerprint, group ID, and traveler name are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Verify the device session exists and is valid
    const { data: session, error: sessionError } = await supabase
      .from('device_sessions')
      .select('id')
      .eq('device_fingerprint', deviceFingerprint)
      .eq('group_id', groupId)
      .eq('traveler_name', travelerName)
      .eq('is_active', true)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Invalid or expired device session' },
        { status: 401 }
      )
    }

    // Get group info
    const { data: group, error: groupError } = await supabase
      .from('travel_groups')
      .select('id, name, access_code')
      .eq('id', groupId)
      .single()

    // Get member info
    const { data: member, error: memberError } = await supabase
      .from('group_members')
      .select('role, permissions')
      .eq('group_id', groupId)
      .eq('traveler_name', travelerName)
      .single()

    if (groupError || !group || memberError || !member) {
      return NextResponse.json(
        { error: 'Group or member not found' },
        { status: 404 }
      )
    }

    // Create unified session (handles both cookies and device session)
    const sessionResult = await createUnifiedSession(
      groupId, 
      travelerName, 
      deviceFingerprint,
      request.headers.get('user-agent') || undefined
    )

    if (!sessionResult.success) {
      return NextResponse.json(
        { error: sessionResult.error || 'Failed to create session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        accessCode: group.access_code
      },
      currentMember: {
        name: travelerName,
        role: member.role,
        permissions: member.permissions
      }
    })

  } catch (error) {
    console.error('Error in auto-login:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}