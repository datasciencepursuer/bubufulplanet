import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

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

        // First, deactivate any existing sessions for this device
        await prisma.deviceSession.updateMany({
          where: {
            deviceFingerprint,
            isActive: true
          },
          data: {
            isActive: false
          }
        })

        // Then create new session for the current group
        await prisma.deviceSession.create({
          data: {
            deviceFingerprint,
            groupId: group.id,
            travelerName: travelerName.trim(),
            userAgent,
            ipAddress: ip,
            isActive: true
          }
        })
      } catch (error) {
        // Don't fail the login if device session save fails
        console.error('Failed to save device session:', error)
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