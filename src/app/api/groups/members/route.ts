import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

// Get group members
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get groupId from query params or use user's current group
    const { searchParams } = new URL(request.url)
    const requestedGroupId = searchParams.get('groupId')

    let groupId: string

    if (requestedGroupId) {
      // Verify user is a member of the requested group
      const userGroup = await prisma.userGroup.findFirst({
        where: { 
          userId: user.id,
          groupId: requestedGroupId
        }
      })

      if (!userGroup) {
        return NextResponse.json({ error: 'Access denied to this group' }, { status: 403 })
      }
      
      groupId = requestedGroupId
    } else {
      // Get user's first group (fallback behavior)
      const userGroup = await prisma.userGroup.findFirst({
        where: { userId: user.id },
        include: { group: true }
      })

      if (!userGroup) {
        return NextResponse.json({ error: 'No group found' }, { status: 404 })
      }

      groupId = userGroup.groupId
    }

    // Get group members using Prisma
    const members = await prisma.groupMember.findMany({
      where: {
        groupId
      },
      select: {
        id: true,
        travelerName: true,
        email: true,
        role: true,
        permissions: true,
        joinedAt: true,
        userId: true
      },
      orderBy: {
        joinedAt: 'asc'
      }
    })

    // Transform to match expected format with current user flag and linked status
    const transformedMembers = members.map(member => ({
      id: member.id,
      travelerName: member.travelerName,
      email: member.email,
      role: member.role,
      permissions: member.permissions,
      joinedAt: member.joinedAt.toISOString(),
      isCurrentUser: member.userId === user.id,
      isLinked: !!member.userId // Whether this member has linked their account
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

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Check if current user is an adventurer using Prisma
    const currentMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id
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

// Invite new member to group (adventurers only)
export async function POST(request: NextRequest) {
  try {
    const { 
      travelerName, 
      email, 
      permissions = { read: true, create: true, modify: false },
      role = 'party member' 
    }: { 
      travelerName: string; 
      email: string;
      permissions?: { read: boolean; create: boolean; modify: boolean };
      role?: 'adventurer' | 'party member';
    } = await request.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get groupId from query params or use user's current group
    const { searchParams } = new URL(request.url)
    const requestedGroupId = searchParams.get('groupId')

    let groupId: string

    if (requestedGroupId) {
      // Verify user is a member of the requested group
      const userGroup = await prisma.userGroup.findFirst({
        where: { 
          userId: user.id,
          groupId: requestedGroupId
        }
      })

      if (!userGroup) {
        return NextResponse.json({ error: 'Access denied to this group' }, { status: 403 })
      }
      
      groupId = requestedGroupId
    } else {
      // Get user's first group (fallback behavior)
      const userGroup = await prisma.userGroup.findFirst({
        where: { userId: user.id },
        include: { group: true }
      })

      if (!userGroup) {
        return NextResponse.json({ error: 'No group found' }, { status: 404 })
      }

      groupId = userGroup.groupId
    }

    if (!travelerName?.trim()) {
      return NextResponse.json({ error: 'Traveler name is required' }, { status: 400 })
    }

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 })
    }

    // Check if current user is an adventurer using Prisma
    const currentMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id
      },
      select: {
        role: true
      }
    })

    if (!currentMember || currentMember.role !== 'adventurer') {
      return NextResponse.json({ error: 'Only group adventurers can invite members' }, { status: 403 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Check if email is already in group using Prisma
    const existingEmailMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        email: normalizedEmail
      },
      select: {
        id: true
      }
    })

    if (existingEmailMember) {
      return NextResponse.json({ error: 'This email is already invited to the group' }, { status: 400 })
    }

    // Check if traveler name already exists in group using Prisma
    const existingNameMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        travelerName: travelerName.trim()
      },
      select: {
        id: true
      }
    })

    if (existingNameMember) {
      return NextResponse.json({ error: 'Traveler name already exists in this group' }, { status: 400 })
    }

    // Create member with invitation
    const member = await prisma.groupMember.create({
      data: {
        groupId,
        travelerName: travelerName.trim(),
        email: normalizedEmail,
        role,
        permissions: role === 'adventurer' 
          ? { read: true, create: true, modify: true }
          : permissions
      }
    })

    // Check if this email has a Supabase account and link immediately
    try {
      const { data: userData } = await supabase.auth.admin.listUsers()
      const existingUser = userData?.users?.find(user => user.email === normalizedEmail)
      
      if (existingUser) {
        // User exists, link them immediately
        await prisma.groupMember.update({
          where: { id: member.id },
          data: { userId: existingUser.id }
        })

        // Create UserGroup entry
        await prisma.userGroup.upsert({
          where: {
            unique_user_group: {
              userId: existingUser.id,
              groupId
            }
          },
          update: {},
          create: {
            userId: existingUser.id,
            groupId,
            role: role === 'adventurer' ? 'leader' : 'member',
            invitedBy: user.id
          }
        })

        return NextResponse.json({ 
          success: true,
          status: 'added_existing_user',
          message: 'User added to group immediately'
        })
      } else {
        return NextResponse.json({ 
          success: true,
          status: 'invited_new_user',
          message: 'Invitation created. User will be added when they sign up.'
        })
      }
    } catch (adminError) {
      // If admin call fails, still create the invitation
      return NextResponse.json({ 
        success: true,
        status: 'invited_pending',
        message: 'Invitation created. User will be added when they sign up.'
      })
    }

  } catch (error) {
    console.error('Error in members POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}