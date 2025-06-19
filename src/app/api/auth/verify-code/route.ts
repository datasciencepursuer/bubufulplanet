import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { extendSessionLifespan, type SessionType } from '@/lib/session-config'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { code, travelerName, deviceFingerprint, userAgent } = body

    if (!code || !travelerName) {
      return NextResponse.json(
        { error: 'Access code and traveler name are required' },
        { status: 400 }
      )
    }

    // Find travel group by access code using Prisma
    const travelGroup = await prisma.travelGroup.findUnique({
      where: { accessCode: code },
      include: {
        groupMembers: {
          where: { travelerName }
        }
      }
    })

    if (!travelGroup) {
      return NextResponse.json(
        { error: 'Invalid access code' },
        { status: 401 }
      )
    }

    // Check if traveler exists in the group
    let groupMember = travelGroup.groupMembers[0]
    
    if (!groupMember) {
      // Create new group member if they don't exist
      groupMember = await prisma.groupMember.create({
        data: {
          groupId: travelGroup.id,
          travelerName,
          role: 'party member',
          permissions: { read: true, create: false, modify: false }
        }
      })
    }

    // Create/update device session if fingerprint provided
    if (deviceFingerprint) {
      // Extend session lifespan from current login time
      const sessionType: SessionType = 'remember_device'
      const { expiresAt, maxIdleTime, lastUsed } = extendSessionLifespan(sessionType)
      
      // Check if device exists, create if not
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
      await prisma.deviceSession.upsert({
        where: {
          unique_device_group_session: {
            deviceFingerprint,
            groupId: travelGroup.id
          }
        },
        update: {
          currentTravelerName: travelerName,
          availableTravelers: [travelerName],
          sessionType,
          expiresAt,
          maxIdleTime,
          userAgent,
          isActive: true,
          lastUsed
        },
        create: {
          deviceFingerprint,
          groupId: travelGroup.id,
          currentTravelerName: travelerName,
          availableTravelers: [travelerName],
          sessionType,
          expiresAt,
          maxIdleTime,
          userAgent,
          isActive: true
        }
      })
    }

    // Create session cookies
    const sessionId = `group-${travelGroup.id}-${Date.now()}`
    const cookieStore = await cookies()
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    }

    cookieStore.set('vacation-planner-session', sessionId, cookieOptions)
    cookieStore.set('vacation-planner-group-id', travelGroup.id, cookieOptions)
    cookieStore.set('vacation-planner-traveler-name', travelerName, cookieOptions)

    return NextResponse.json({ 
      success: true,
      groupId: travelGroup.id,
      travelerName,
      role: groupMember.role,
      permissions: groupMember.permissions
    })
  } catch (error) {
    console.error('Error verifying access code:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}