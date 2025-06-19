import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extendSessionLifespan, type SessionType } from '@/lib/session-config'

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

    // Extend session lifespan from current login time
    const sessionType: SessionType = 'remember_device'
    const { expiresAt, maxIdleTime, lastUsed } = extendSessionLifespan(sessionType)

    // Ensure device exists
    await prisma.device.upsert({
      where: { fingerprint: deviceFingerprint },
      update: { 
        userAgent,
        updatedAt: new Date()
      },
      create: {
        fingerprint: deviceFingerprint,
        userAgent
      }
    })

    // Upsert device session (one per device per group)
    const session = await prisma.deviceSession.upsert({
      where: {
        unique_device_group_session: {
          deviceFingerprint,
          groupId
        }
      },
      update: {
        currentTravelerName: travelerName,
        availableTravelers: [travelerName],
        sessionType,
        expiresAt,
        maxIdleTime,
        userAgent,
        ipAddress: ip,
        isActive: true,
        lastUsed
      },
      create: {
        deviceFingerprint,
        groupId,
        currentTravelerName: travelerName,
        availableTravelers: [travelerName],
        sessionType,
        expiresAt,
        maxIdleTime,
        userAgent,
        ipAddress: ip,
        isActive: true
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