import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { extendSessionLifespan, type SessionType } from '@/lib/session-config'

interface GroupMember {
  name: string
  role: 'adventurer' | 'party member'
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function POST(request: NextRequest) {
  try {
    const { groupName, members, deviceFingerprint }: { 
      groupName: string; 
      members: GroupMember[];
      deviceFingerprint?: string;
    } = await request.json()

    if (!groupName?.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    if (!members?.length || !members[0]?.name?.trim()) {
      return NextResponse.json({ error: 'At least one member is required' }, { status: 400 })
    }

    // Ensure first member is an adventurer
    const validMembers = members.filter(m => m.name.trim())
    if (validMembers[0].role !== 'adventurer') {
      validMembers[0].role = 'adventurer'
    }

    // Generate unique access code
    let accessCode = generateAccessCode()
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      const existingGroup = await prisma.travelGroup.findUnique({
        where: { accessCode },
        select: { id: true }
      })

      if (!existingGroup) break
      
      accessCode = generateAccessCode()
      attempts++
    }

    if (attempts === maxAttempts) {
      return NextResponse.json({ error: 'Unable to generate unique access code' }, { status: 500 })
    }

    // Create the travel group
    const group = await prisma.travelGroup.create({
      data: {
        name: groupName.trim(),
        accessCode: accessCode,
        createdBy: null // Will be updated after creating adventurer member
      }
    })

    // Add group members
    let adventurerMemberId: string | null = null
    
    try {
      for (const member of validMembers) {
        const insertedMember = await prisma.groupMember.create({
          data: {
            groupId: group.id,
            travelerName: member.name.trim(),
            role: member.role,
            permissions: member.role === 'adventurer' 
              ? { read: true, create: true, modify: true }
              : { read: true, create: false, modify: false }
          }
        })
        
        if (member.role === 'adventurer') {
          adventurerMemberId = insertedMember.id
        }
      }
      
      // Update the group's created_by field with adventurer member ID
      if (adventurerMemberId) {
        await prisma.travelGroup.update({
          where: { id: group.id },
          data: { createdBy: adventurerMemberId }
        })
      }
    } catch (membersError) {
      console.error('Error adding members:', membersError)
      // Clean up the group if member insertion fails
      await prisma.travelGroup.delete({ where: { id: group.id } })
      return NextResponse.json({ error: 'Failed to add group members' }, { status: 500 })
    }

    // Set session cookies for the group creator (first member)
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
    cookieStore.set('vacation-planner-traveler-name', validMembers[0].name.trim(), cookieOptions)

    // Save device session if fingerprint provided
    if (deviceFingerprint) {
      try {
        const userAgent = request.headers.get('user-agent') || 'unknown'
        const forwardedFor = request.headers.get('x-forwarded-for')
        const realIp = request.headers.get('x-real-ip')
        const ip = forwardedFor?.split(',')[0] || realIp || '127.0.0.1'

        // Delete ALL existing sessions for this traveler in ANY group (they're creating a new group)
        const deletedSessions = await prisma.deviceSession.deleteMany({
          where: {
            currentTravelerName: validMembers[0].name.trim()
          }
        })
        
        if (deletedSessions.count > 0) {
          console.log(`Deleted ${deletedSessions.count} previous sessions for ${validMembers[0].name.trim()}`)
        }

        // Extend session lifespan from current login time
        const sessionType: SessionType = 'remember_device'
        const { expiresAt, maxIdleTime, lastUsed } = extendSessionLifespan(sessionType)

        // Create device if not exists
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

        // Then create new session for the current group
        await prisma.deviceSession.create({
          data: {
            deviceFingerprint,
            groupId: group.id,
            currentTravelerName: validMembers[0].name.trim(),
            availableTravelers: [validMembers[0].name.trim()],
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
        // Don't fail the group creation if device session save fails
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
        name: validMembers[0].name.trim(),
        role: 'adventurer'
      }
    })

  } catch (error) {
    console.error('Error in group creation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}