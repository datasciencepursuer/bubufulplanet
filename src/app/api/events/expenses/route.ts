import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get('tripId')
    
    if (!tripId) {
      return NextResponse.json({ error: 'Trip ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get groupId from header or query params, fallback to user's first group
    const headerGroupId = request.headers.get('x-group-id')
    const queryGroupId = searchParams.get('groupId')
    const requestedGroupId = headerGroupId || queryGroupId

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
      // Fallback to user's first group
      const userGroup = await prisma.userGroup.findFirst({
        where: { userId: user.id },
        include: { group: true }
      })

      if (!userGroup) {
        return NextResponse.json({ error: 'No group found' }, { status: 404 })
      }

      groupId = userGroup.groupId
    }
      // First verify the trip belongs to the user's group
      const trip = await prisma.trip.findFirst({
        where: {
          id: tripId,
          groupId: groupId
        }
      })

      if (!trip) {
        return NextResponse.json({ 
          error: 'Trip not found',
          details: 'Trip does not exist or you do not have access'
        }, { status: 404 })
      }

      // Get ALL expenses for this trip (both event-linked and standalone)
      const expenses = await prisma.expense.findMany({
        where: {
          tripId: tripId,
          groupId: groupId
        },
        include: {
          event: true,
          day: true,
          owner: true,
          participants: {
            include: {
              participant: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      const response = NextResponse.json({ expenses });
      
      // Add cache headers for expenses data
      response.headers.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=240'); // 2 min cache, 4 min stale
      response.headers.set('ETag', `expenses-${groupId}-${tripId}-${Date.now()}`);
      
      return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Unexpected error in GET /api/events/expenses:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}