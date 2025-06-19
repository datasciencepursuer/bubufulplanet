import { NextRequest, NextResponse } from 'next/server'
import { createUnifiedSession } from '@/lib/unified-session'
import { prisma } from '@/lib/prisma'
import { isSessionValid, extendSessionLifespan, type SessionType } from '@/lib/session-config'

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

    // Verify the device session exists and is valid using Prisma
    const session = await prisma.deviceSession.findUnique({
      where: {
        unique_device_group_session: {
          deviceFingerprint,
          groupId
        }
      },
      select: { 
        id: true,
        currentTravelerName: true,
        availableTravelers: true,
        sessionType: true,
        expiresAt: true,
        maxIdleTime: true,
        lastUsed: true,
        isActive: true
      }
    })

    if (!session || !session.isActive) {
      return NextResponse.json(
        { error: 'Device session not found' },
        { status: 401 }
      )
    }

    // Check if session is still valid (not expired or idle)
    if (!isSessionValid(session)) {
      return NextResponse.json(
        { error: 'Device session expired' },
        { status: 401 }
      )
    }

    // Check if the requested traveler is available on this device
    const availableTravelers = Array.isArray(session.availableTravelers) ? session.availableTravelers : []
    if (!availableTravelers.includes(travelerName)) {
      return NextResponse.json(
        { error: 'Traveler not available on this device session' },
        { status: 401 }
      )
    }

    // Extend session lifespan on successful auto-login
    const sessionType = (session.sessionType as SessionType) || 'remember_device'
    const { expiresAt, maxIdleTime, lastUsed } = extendSessionLifespan(sessionType)
    
    // Update session with extended lifespan
    await prisma.deviceSession.update({
      where: { id: session.id },
      data: {
        currentTravelerName: travelerName,
        expiresAt,
        maxIdleTime,
        lastUsed
      }
    })

    // Get group info using Prisma
    const group = await prisma.travelGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        accessCode: true
      }
    })

    // Get member info using Prisma
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        travelerName
      },
      select: {
        role: true,
        permissions: true
      }
    })

    if (!group || !member) {
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
        accessCode: group.accessCode
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