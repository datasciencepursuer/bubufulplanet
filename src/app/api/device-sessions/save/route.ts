import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceFingerprint, groupId, travelerName, userAgent } = body

    if (!deviceFingerprint || !groupId || !travelerName) {
      return NextResponse.json(
        { error: 'Device fingerprint, group ID, and traveler name are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Get client IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwardedFor?.split(',')[0] || realIp || '127.0.0.1'

    // Save/update device session using the stored procedure
    const { data: sessionId, error } = await supabase.rpc('refresh_device_session', {
      p_device_fingerprint: deviceFingerprint,
      p_group_id: groupId,
      p_traveler_name: travelerName,
      p_user_agent: userAgent,
      p_ip_address: ip
    })

    if (error) {
      console.error('Error saving device session:', error)
      return NextResponse.json(
        { error: 'Failed to save device session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sessionId
    })

  } catch (error) {
    console.error('Error in device session save:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}