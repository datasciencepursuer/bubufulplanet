import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { groupId } = params

    // Check if user is member of the group
    const userGroup = await prisma.userGroup.findUnique({
      where: {
        unique_user_group: {
          userId: user.id,
          groupId
        }
      }
    })

    if (!userGroup) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    // Get all group members
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: {
        id: true,
        travelerName: true,
        email: true,
        role: true,
        joinedAt: true,
        userId: true
      },
      orderBy: { joinedAt: 'asc' }
    })

    return NextResponse.json({ members })
  } catch (error) {
    console.error('Error fetching group members:', error)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}