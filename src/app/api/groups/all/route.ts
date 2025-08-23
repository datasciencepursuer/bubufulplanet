import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'

// Get all groups for the authenticated user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all user's groups with additional info
    const userGroups = await prisma.userGroup.findMany({
      where: { userId: user.id },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            accessCode: true,
            createdAt: true,
            _count: {
              select: {
                groupMembers: true
              }
            }
          }
        }
      },
      orderBy: {
        group: {
          createdAt: 'asc' // Show oldest groups first (likely their main group)
        }
      }
    })

    if (!userGroups.length) {
      return NextResponse.json({ error: 'No groups found' }, { status: 404 })
    }

    const groups = userGroups.map(userGroup => ({
      id: userGroup.group.id,
      name: userGroup.group.name,
      accessCode: userGroup.group.accessCode,
      role: userGroup.role,
      memberCount: userGroup.group._count.groupMembers,
      createdAt: userGroup.group.createdAt.toISOString()
    }))

    return NextResponse.json({
      groups,
      total: groups.length
    })

  } catch (error) {
    console.error('Error fetching user groups:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}