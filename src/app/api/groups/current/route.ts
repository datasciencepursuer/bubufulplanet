import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// Get current user's group information
export async function GET() {
  try {
    const cookieStore = await cookies()
    const groupId = cookieStore.get('vacation-planner-group-id')?.value
    const travelerName = cookieStore.get('vacation-planner-traveler-name')?.value

    if (!groupId || !travelerName) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get group details using Prisma
    const group = await prisma.travelGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        accessCode: true,
        createdAt: true
      }
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Get current user's member info using Prisma
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        travelerName
      },
      select: {
        id: true,
        travelerName: true,
        role: true,
        permissions: true,
        joinedAt: true
      }
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Get all group members using Prisma
    const allMembers = await prisma.groupMember.findMany({
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

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        accessCode: group.accessCode,
        createdAt: group.createdAt.toISOString()
      },
      currentMember: {
        id: member.id,
        name: member.travelerName,
        role: member.role,
        permissions: member.permissions,
        joinedAt: member.joinedAt.toISOString()
      },
      allMembers: allMembers.map(m => ({
        id: m.id,
        traveler_name: m.travelerName,
        role: m.role,
        permissions: m.permissions,
        joined_at: m.joinedAt.toISOString()
      }))
    })

  } catch (error) {
    console.error('Error in current group GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}