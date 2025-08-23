import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the group ID from the request body
    const { groupId }: { groupId: string } = await request.json()

    if (!groupId) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
    }

    // Verify user is a member of this group
    const userGroup = await prisma.userGroup.findFirst({
      where: { 
        userId: user.id,
        groupId: groupId
      }
    })

    if (!userGroup) {
      return NextResponse.json({ error: 'You are not a member of this group' }, { status: 403 })
    }

    // Get user's member record to check role
    const memberRecord = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: user.id
      }
    })

    if (!memberRecord) {
      return NextResponse.json({ error: 'Member record not found' }, { status: 404 })
    }

    // Prevent adventurer from leaving if they're the only adventurer
    if (memberRecord.role === 'adventurer') {
      const adventurerCount = await prisma.groupMember.count({
        where: {
          groupId: groupId,
          role: 'adventurer'
        }
      })

      if (adventurerCount <= 1) {
        return NextResponse.json({ 
          error: 'Cannot leave group. You are the only adventurer. Transfer leadership or delete the group first.' 
        }, { status: 400 })
      }
    }

    // Remove user from the group
    // Delete from both tables in transaction
    await prisma.$transaction([
      prisma.groupMember.delete({
        where: { id: memberRecord.id }
      }),
      prisma.userGroup.delete({
        where: {
          unique_user_group: {
            userId: user.id,
            groupId: groupId
          }
        }
      })
    ])

    return NextResponse.json({ 
      success: true,
      message: 'Successfully left the group' 
    })

  } catch (error) {
    console.error('Error in leave group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}