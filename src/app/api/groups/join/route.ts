import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { extendSessionLifespan, type SessionType } from '@/lib/session-config'

export async function POST(request: NextRequest) {
  try {
    const { accessCode, travelerName, deviceFingerprint }: { 
      accessCode: string; 
      travelerName: string;
      deviceFingerprint?: string;
    } = await request.json()

    if (!accessCode?.trim()) {
      return NextResponse.json({ error: 'Access code is required' }, { status: 400 })
    }

    if (!travelerName?.trim()) {
      return NextResponse.json({ error: 'Traveler name is required' }, { status: 400 })
    }

    // Find the group by access code using Prisma
    const group = await prisma.travelGroup.findUnique({
      where: { accessCode: accessCode.trim().toUpperCase() },
      include: {
        groupMembers: {
          where: { travelerName: travelerName.trim() }
        }
      }
    })

    if (!group) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 401 })
    }

    // Check if the traveler name exists in this group
    const member = group.groupMembers[0]
    if (!member) {
      return NextResponse.json({ error: 'Traveler name not found in this group' }, { status: 401 })
    }

    // Authentication successful - set session cookies
    const sessionId = `group-${group.id}-${Date.now()}`
    
    const cookieStore = await cookies()
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    }

    cookieStore.set('vacation-planner-session', sessionId, cookieOptions)
    cookieStore.set('vacation-planner-group-id', group.id, cookieOptions)
    cookieStore.set('vacation-planner-traveler-name', travelerName.trim(), cookieOptions)

    // Save device session if fingerprint provided
    if (deviceFingerprint) {
      try {
        const userAgent = request.headers.get('user-agent') || 'unknown'
        const forwardedFor = request.headers.get('x-forwarded-for')
        const realIp = request.headers.get('x-real-ip')
        const ip = forwardedFor?.split(',')[0] || realIp || '127.0.0.1'

        // Delete ALL existing sessions for this traveler in this group (across all devices)
        const deletedSessions = await prisma.deviceSession.deleteMany({
          where: {
            groupId: group.id,
            currentTravelerName: travelerName.trim()
          }
        })
        
        if (deletedSessions.count > 0) {
          console.log(`Deleted ${deletedSessions.count} previous sessions for ${travelerName.trim()} in group ${group.id}`)
        }

        // Extend session lifespan from current login time
        const sessionType: SessionType = 'remember_device'
        const { expiresAt, maxIdleTime, lastUsed } = extendSessionLifespan(sessionType)

        // Create device if not exists
        await prisma.device.upsert({
          where: { fingerprint: deviceFingerprint },
          update: { 
            userAgent: request.headers.get('user-agent') || undefined,
            updatedAt: new Date()
          },
          create: {
            fingerprint: deviceFingerprint,
            userAgent: request.headers.get('user-agent') || undefined
          }
        })

        // Create new session for the current device and group
        await prisma.deviceSession.create({
          data: {
            deviceFingerprint,
            groupId: group.id,
            currentTravelerName: travelerName.trim(),
            availableTravelers: [travelerName.trim()],
            sessionType,
            expiresAt,
            maxIdleTime,
            userAgent,
            ipAddress: ip,
            isActive: true,
            lastUsed
          }
        })
        
      } catch (error) {
        // Don't fail the login if device session save fails
        console.error('[API] Failed to save device session:', error)
        console.error('[API] Error details:', {
          deviceFingerprint,
          groupId: group.id,
          travelerName: travelerName.trim(),
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return NextResponse.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        accessCode: group.accessCode
      },
      currentMember: {
        name: member.travelerName,
        role: member.role,
        permissions: member.permissions
      }
    })

  } catch (error) {
    console.error('Error in group join:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}