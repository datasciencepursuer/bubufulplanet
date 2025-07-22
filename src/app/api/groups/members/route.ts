import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// Get group members
export async function GET() {
  try {
    const cookieStore = await cookies()
    const groupId = cookieStore.get('vacation-planner-group-id')?.value
    const travelerName = cookieStore.get('vacation-planner-traveler-name')?.value

    if (!groupId || !travelerName) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get group members using Prisma
    const members = await prisma.groupMember.findMany({
      where: {
        groupId
      },
      select: {
        id: true,
        travelerName: true,
        role: true,
        permissions: true,
        joinedAt: true
      },
      orderBy: {
        joinedAt: 'asc'
      }
    })

    // Transform to match expected format with current user flag
    const transformedMembers = members.map(member => ({
      id: member.id,
      travelerName: member.travelerName,
      role: member.role,
      permissions: member.permissions,
      joinedAt: member.joinedAt.toISOString(),
      isCurrentUser: member.travelerName === travelerName
    }))

    const response = NextResponse.json({ members: transformedMembers });
    
    // Add cache headers for group members data (longer cache since it changes infrequently)
    response.headers.set('Cache-Control', 'private, max-age=600, stale-while-revalidate=1200'); // 10 min cache, 20 min stale
    response.headers.set('ETag', `members-${groupId}-${Date.now()}`);
    
    return response;

  } catch (error) {
    console.error('Error in members GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Update member permissions (adventurers only)
export async function PUT(request: NextRequest) {
  try {
    const { memberId, permissions }: { memberId: string; permissions: { read: boolean; create: boolean; modify: boolean } } = await request.json()

    const cookieStore = await cookies()
    const groupId = cookieStore.get('vacation-planner-group-id')?.value
    const travelerName = cookieStore.get('vacation-planner-traveler-name')?.value

    if (!groupId || !travelerName) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if current user is an adventurer using Prisma
    const currentMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        travelerName
      },
      select: {
        role: true
      }
    })

    if (!currentMember || currentMember.role !== 'adventurer') {
      return NextResponse.json({ error: 'Only group adventurers can update permissions' }, { status: 403 })
    }

    // Update member permissions using Prisma
    await prisma.groupMember.update({
      where: {
        id: memberId,
        groupId // Ensure we're only updating members in the same group
      },
      data: {
        permissions
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in members PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Add new member to group (adventurers only)
export async function POST(request: NextRequest) {
  try {
    const { travelerName, role = 'party member' }: { travelerName: string; role?: 'adventurer' | 'party member' } = await request.json()

    const cookieStore = await cookies()
    const groupId = cookieStore.get('vacation-planner-group-id')?.value
    const currentTravelerName = cookieStore.get('vacation-planner-traveler-name')?.value

    if (!groupId || !currentTravelerName) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!travelerName?.trim()) {
      return NextResponse.json({ error: 'Traveler name is required' }, { status: 400 })
    }

    // Check if current user is an adventurer using Prisma
    const currentMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        travelerName: currentTravelerName
      },
      select: {
        role: true
      }
    })

    if (!currentMember || currentMember.role !== 'adventurer') {
      return NextResponse.json({ error: 'Only group adventurers can add members' }, { status: 403 })
    }

    // Check if traveler name already exists in group using Prisma
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        travelerName: travelerName.trim()
      },
      select: {
        id: true
      }
    })

    if (existingMember) {
      return NextResponse.json({ error: 'Traveler name already exists in this group' }, { status: 400 })
    }

    // Add new member using Prisma
    await prisma.groupMember.create({
      data: {
        groupId,
        travelerName: travelerName.trim(),
        role,
        permissions: role === 'adventurer' 
          ? { read: true, create: true, modify: true }
          : { read: true, create: false, modify: false }
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in members POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}