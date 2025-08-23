import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'

// Get user's group information (specific group or default first group)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if a specific group ID is requested
    const { searchParams } = new URL(request.url)
    const requestedGroupId = searchParams.get('groupId')

    let userGroup
    if (requestedGroupId) {
      // Get specific group if user is a member
      userGroup = await prisma.userGroup.findFirst({
        where: { 
          userId: user.id,
          groupId: requestedGroupId
        },
        include: { 
          group: {
            select: {
              id: true,
              name: true,
              accessCode: true,
              createdAt: true
            }
          }
        }
      })
    } else {
      // Get user's first group (default behavior)
      userGroup = await prisma.userGroup.findFirst({
        where: { userId: user.id },
        include: { 
          group: {
            select: {
              id: true,
              name: true,
              accessCode: true,
              createdAt: true
            }
          }
        }
      })
    }

    if (!userGroup || !userGroup.group) {
      return NextResponse.json({ error: 'No group found' }, { status: 404 })
    }

    const groupId = userGroup.groupId
    const travelerName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

    const group = userGroup.group

    // Get current user's member info linked by userId
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id
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
      // Debug: Check what member records exist for this user and group
      const debugMembers = await prisma.groupMember.findMany({
        where: {
          OR: [
            { groupId, userId: user.id },
            { groupId, email: user.email },
            { userId: user.id }
          ]
        },
        select: {
          id: true,
          groupId: true,
          userId: true,
          email: true,
          travelerName: true
        }
      })
      
      console.log('Debug - Member not found:', {
        requestedGroupId: groupId,
        userId: user.id,
        userEmail: user.email,
        availableMembers: debugMembers
      })
      
      return NextResponse.json({ 
        error: 'Member not found',
        debug: {
          requestedGroupId: groupId,
          userId: user.id,
          userEmail: user.email,
          availableMembers: debugMembers
        }
      }, { status: 404 })
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
      travelerName: member.travelerName,
      role: member.role,
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

// Update current user's traveler name
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { travelerName }: { travelerName: string } = await request.json()

    if (!travelerName?.trim()) {
      return NextResponse.json({ error: 'Traveler name is required' }, { status: 400 })
    }

    // Get user's current group
    const userGroup = await prisma.userGroup.findFirst({
      where: { userId: user.id },
      include: { group: true }
    })

    if (!userGroup) {
      return NextResponse.json({ error: 'No group found' }, { status: 404 })
    }

    const groupId = userGroup.groupId

    // Check if traveler name already exists in group
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        travelerName: travelerName.trim(),
        userId: { not: user.id } // Exclude current user
      }
    })

    if (existingMember) {
      return NextResponse.json({ error: 'Traveler name already exists in this group' }, { status: 400 })
    }

    // Update the member's traveler name
    const updatedMember = await prisma.groupMember.updateMany({
      where: {
        groupId,
        userId: user.id
      },
      data: {
        travelerName: travelerName.trim()
      }
    })

    if (updatedMember.count === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, travelerName: travelerName.trim() })

  } catch (error) {
    console.error('Error updating traveler name:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}