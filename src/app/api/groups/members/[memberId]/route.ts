import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params
    const cookieStore = await cookies()
    const groupId = cookieStore.get('vacation-planner-group-id')?.value
    const travelerName = cookieStore.get('vacation-planner-traveler-name')?.value

    if (!groupId || !travelerName) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if current user is an adventurer
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
      return NextResponse.json({ error: 'Only group adventurers can remove members' }, { status: 403 })
    }

    // Get member to be deleted
    const targetMember = await prisma.groupMember.findFirst({
      where: {
        id: memberId,
        groupId // Ensure member is in the same group
      }
    })

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Prevent removing adventurer
    if (targetMember.role === 'adventurer') {
      return NextResponse.json({ error: 'Cannot remove the adventurer from the group' }, { status: 400 })
    }

    // Delete the member
    await prisma.groupMember.delete({
      where: { id: memberId }
    })

    // Also delete any device sessions for this member
    await prisma.deviceSession.deleteMany({
      where: {
        groupId,
        currentTravelerName: targetMember.travelerName
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in member DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}