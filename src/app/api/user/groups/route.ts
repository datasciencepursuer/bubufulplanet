import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

// Get all groups for the authenticated user (max 5)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get user's groups from UserGroup table (by userId or email for invitations)
    const userGroups = await prisma.userGroup.findMany({
      where: { 
        OR: [
          { userId: user.id },
          { email: user.email }
        ]
      },
      include: {
        group: {
          include: {
            trips: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true
              },
              orderBy: { startDate: 'desc' },
              take: 5
            },
            _count: {
              select: {
                groupMembers: true,
                trips: true
              }
            }
          }
        }
      },
      orderBy: { joinedAt: 'desc' },
      take: 5 // Max 5 groups per user
    })

    // Also check for legacy groups (created before the refactor)
    const legacyGroups = await prisma.travelGroup.findMany({
      where: { createdById: user.id },
      include: {
        trips: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true
          },
          orderBy: { startDate: 'desc' },
          take: 5
        },
        _count: {
          select: {
            groupMembers: true,
            trips: true
          }
        }
      }
    })

    // Combine and deduplicate groups
    const allGroupIds = new Set<string>()
    const allGroups = []

    // Add UserGroup entries
    for (const ug of userGroups) {
      if (!allGroupIds.has(ug.group.id)) {
        allGroupIds.add(ug.group.id)
        allGroups.push({
          id: ug.group.id,
          name: ug.group.name,
          accessCode: ug.group.accessCode,
          role: ug.role,
          joinedAt: ug.joinedAt,
          memberCount: ug.group._count.groupMembers,
          tripCount: ug.group._count.trips,
          recentTrips: ug.group.trips,
          isLegacy: false
        })
      }
    }

    // Add legacy groups
    for (const group of legacyGroups) {
      if (!allGroupIds.has(group.id)) {
        allGroupIds.add(group.id)
        allGroups.push({
          id: group.id,
          name: group.name,
          accessCode: group.accessCode,
          role: 'leader', // Creator is always leader
          joinedAt: group.createdAt,
          memberCount: group._count.groupMembers,
          tripCount: group._count.trips,
          recentTrips: group.trips,
          isLegacy: true
        })

        // Create UserGroup entry for legacy groups
        await prisma.userGroup.upsert({
          where: {
            unique_user_group: {
              userId: user.id,
              groupId: group.id
            }
          },
          update: {},
          create: {
            userId: user.id,
            groupId: group.id,
            role: 'leader'
          }
        })
      }
    }

    // Limit to 5 groups total
    const groups = allGroups.slice(0, 5)

    return NextResponse.json({ groups })
  } catch (error) {
    console.error('Error fetching user groups:', error)
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }
}