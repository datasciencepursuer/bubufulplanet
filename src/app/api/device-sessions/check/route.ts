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

    // Find active device sessions for this fingerprint
    const sessions = await prisma.deviceSession.findMany({
      where: {
        deviceFingerprint,
        isActive: true
      },
      orderBy: {
        lastUsed: 'desc'
      }
    })

    // Get additional data for each session manually
    const availableSessions = []
    for (const session of sessions) {
      // Get group info
      const group = await prisma.travelGroup.findUnique({
        where: { id: session.groupId },
        select: { id: true, name: true, accessCode: true }
      })

      // Get member info
      const member = await prisma.groupMember.findFirst({
        where: {
          groupId: session.groupId,
          travelerName: session.travelerName
        },
        select: { role: true, permissions: true }
      })

      if (group && member) {
        availableSessions.push({
          groupId: session.groupId,
          groupName: group.name,
          accessCode: group.accessCode,
          travelerName: session.travelerName,
          role: member.role,
          permissions: member.permissions,
          lastLogin: session.lastUsed
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