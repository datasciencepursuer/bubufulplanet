import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

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

    const cookieStore = await cookies()

    // Clear session cookies
    cookieStore.delete('vacation-planner-session')
    cookieStore.delete('vacation-planner-group-id')
    cookieStore.delete('vacation-planner-traveler-name')

    // Delete device sessions if device fingerprint provided
    if (deviceFingerprint) {
      try {
        // Delete all sessions for this device
        const deleted = await prisma.deviceSession.deleteMany({
          where: {
            deviceFingerprint
          }
        })
        console.log(`Deleted ${deleted.count} device sessions for fingerprint ${deviceFingerprint}`)
      } catch (error) {
        console.warn('Failed to delete device sessions:', error)
        // Don't fail logout for device session issues
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}