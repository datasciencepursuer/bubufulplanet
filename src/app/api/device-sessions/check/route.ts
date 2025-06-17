import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // Find active device sessions for this fingerprint with related data
    const sessions = await prisma.deviceSession.findMany({
      where: {
        deviceFingerprint,
        isActive: true
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            accessCode: true
          }
        },
        member: {
          select: {
            role: true,
            permissions: true
          }
        }
      },
      orderBy: {
        lastUsed: 'desc'
      }
    })

    const availableSessions = sessions.map(session => ({
      groupId: session.groupId,
      groupName: session.group.name,
      accessCode: session.group.accessCode,
      travelerName: session.travelerName,
      role: session.member?.role,
      permissions: session.member?.permissions,
      lastLogin: session.lastUsed
    }))

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