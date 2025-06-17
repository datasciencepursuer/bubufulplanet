import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // Get client IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwardedFor?.split(',')[0] || realIp || '127.0.0.1'

    // First, deactivate any existing sessions for this device/group/traveler combo
    await prisma.deviceSession.updateMany({
      where: {
        deviceFingerprint,
        groupId,
        travelerName,
        isActive: true
      },
      data: {
        isActive: false
      }
    })

    // Create new active session
    const session = await prisma.deviceSession.create({
      data: {
        deviceFingerprint,
        groupId,
        travelerName,
        userAgent,
        ipAddress: ip,
        isActive: true,
        lastUsed: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      sessionId: session.id
    })

  } catch (error) {
    console.error('Error in device session save:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}