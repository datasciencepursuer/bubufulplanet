import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'

interface RouteParams {
  params: Promise<{
    groupId: string
  }>
}

// Update group details (name, etc.) - only for adventurers/leaders
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupId } = await params
    const { name }: { name: string } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    // Check if user is a member of this group and has permissions
    const userGroup = await prisma.userGroup.findFirst({
      where: { 
        userId: user.id,
        groupId 
      }
    })

    if (!userGroup) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    // Get user's member info to check role
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id
      }
    })

    // Only adventurers (role = 'adventurer') can edit group names
    if (!member || member.role !== 'adventurer') {
      return NextResponse.json({ error: 'Only adventurers can edit group names' }, { status: 403 })
    }

    // Update the group name
    const updatedGroup = await prisma.travelGroup.update({
      where: { id: groupId },
      data: { name: name.trim() }
    })

    return NextResponse.json({ 
      success: true, 
      group: {
        id: updatedGroup.id,
        name: updatedGroup.name,
        accessCode: updatedGroup.accessCode
      }
    })

  } catch (error) {
    console.error('Error updating group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get group details - for any member
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupId } = await params

    // Check if user is a member of this group
    const userGroup = await prisma.userGroup.findFirst({
      where: { 
        userId: user.id,
        groupId 
      },
      include: {
        group: {
          include: {
            _count: {
              select: {
                groupMembers: true,
                trips: true
              }
            }
          }
        }
      }
    })

    if (!userGroup) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    // Get user's member info
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id
      }
    })

    return NextResponse.json({
      group: {
        id: userGroup.group.id,
        name: userGroup.group.name,
        accessCode: userGroup.group.accessCode,
        memberCount: userGroup.group._count.groupMembers,
        tripCount: userGroup.group._count.trips
      },
      userRole: userGroup.role,
      memberInfo: member ? {
        id: member.id,
        travelerName: member.travelerName,
        role: member.role,
        permissions: member.permissions
      } : null
    })

  } catch (error) {
    console.error('Error fetching group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}