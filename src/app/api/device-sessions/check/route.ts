import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceFingerprint } = body

    if (!deviceFingerprint) {
      return NextResponse.json(
        { error: 'Device fingerprint is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Find active device sessions for this fingerprint
    const { data: sessions, error } = await supabase
      .from('device_sessions')
      .select(`
        id,
        group_id,
        traveler_name,
        last_used
      `)
      .eq('device_fingerprint', deviceFingerprint)
      .eq('is_active', true)
      .order('last_used', { ascending: false })

    if (error) {
      console.error('Error checking device sessions:', error)
      return NextResponse.json(
        { error: 'Failed to check device sessions' },
        { status: 500 }
      )
    }

    // Get additional data for each session
    const availableSessions = []
    for (const session of sessions || []) {
      // Get group info
      const { data: group } = await supabase
        .from('travel_groups')
        .select('id, name, access_code')
        .eq('id', session.group_id)
        .single()

      // Get member info
      const { data: member } = await supabase
        .from('group_members')
        .select('role, permissions')
        .eq('group_id', session.group_id)
        .eq('traveler_name', session.traveler_name)
        .single()

      if (group && member) {
        availableSessions.push({
          groupId: session.group_id,
          groupName: group.name,
          accessCode: group.access_code,
          travelerName: session.traveler_name,
          role: member.role,
          permissions: member.permissions,
          lastLogin: session.last_used
        })
      }
    }

    return NextResponse.json({
      success: true,
      sessions: availableSessions
    })

  } catch (error) {
    console.error('Error in device session check:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}