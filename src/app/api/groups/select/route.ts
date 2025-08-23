import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'

// Select a group as the current active group
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupId }: { groupId: string } = await request.json()

    if (!groupId) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
    }

    // Verify user is a member of this group
    const userGroup = await prisma.userGroup.findFirst({
      where: { 
        userId: user.id,
        groupId: groupId
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            accessCode: true
          }
        }
      }
    })

    if (!userGroup) {
      return NextResponse.json({ error: 'User is not a member of this group' }, { status: 403 })
    }

    // Get user's member info in this group
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: user.id
      },
      select: {
        id: true,
        travelerName: true,
        role: true,
        permissions: true
      }
    })

    if (!member) {
      return NextResponse.json({ error: 'Member record not found' }, { status: 404 })
    }

    // Return the selected group info
    // Note: In a more complex system, you might store the selected groupId in session/cookies
    // For now, the frontend will handle routing to /app and the current group API will work
    return NextResponse.json({
      success: true,
      group: {
        id: userGroup.group.id,
        name: userGroup.group.name,
        accessCode: userGroup.group.accessCode
      },
      member: {
        travelerName: member.travelerName,
        role: member.role,
        permissions: member.permissions
      }
    })

  } catch (error) {
    console.error('Error selecting group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}