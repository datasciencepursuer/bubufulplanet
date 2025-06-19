import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSessionValid } from '@/lib/session-config'

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
      select: {
        id: true,
        groupId: true,
        currentTravelerName: true,
        availableTravelers: true,
        expiresAt: true,
        maxIdleTime: true,
        lastUsed: true,
        isActive: true
      },
      orderBy: {
        lastUsed: 'desc'
      }
    })

    // Filter valid sessions and get additional data
    const availableSessions = []
    for (const session of sessions) {
      // Check if session is still valid
      if (!isSessionValid(session)) {
        // Mark expired session as inactive
        await prisma.deviceSession.update({
          where: { id: session.id },
          data: { isActive: false }
        })
        continue
      }

      // Get group info
      const group = await prisma.travelGroup.findUnique({
        where: { id: session.groupId },
        select: { id: true, name: true, accessCode: true }
      })

      if (group) {
        // Get available travelers for this session
        const availableTravelers = Array.isArray(session.availableTravelers) ? session.availableTravelers : []
        
        // For each available traveler, get their member info
        for (const travelerName of availableTravelers) {
          const member = await prisma.groupMember.findFirst({
            where: {
              groupId: session.groupId,
              travelerName: String(travelerName)
            },
            select: { role: true, permissions: true }
          })

          if (member) {
            availableSessions.push({
              groupId: session.groupId,
              groupName: group.name,
              accessCode: group.accessCode,
              travelerName: travelerName,
              role: member.role,
              permissions: member.permissions,
              lastLogin: session.lastUsed
            })
          }
        }
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