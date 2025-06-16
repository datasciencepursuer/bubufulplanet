import { NextRequest, NextResponse } from 'next/server'
import { unifiedLogout } from '@/lib/unified-session'

export async function POST(request: NextRequest) {
  try {
    // Get device fingerprint from request body if provided
    let deviceFingerprint: string | undefined
    try {
      const body = await request.json()
      deviceFingerprint = body.deviceFingerprint
    } catch {
      // Body parsing failed, continue without device fingerprint
    }

    // Use unified logout to clear both sessions and cookies
    const success = await unifiedLogout(deviceFingerprint)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Logout partially failed' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}