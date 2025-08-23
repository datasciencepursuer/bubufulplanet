import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { CACHE_TAGS, CACHE_DURATIONS, CacheManager } from '@/lib/cache'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get groupId from header or query params, fallback to user's first group
    const headerGroupId = request.headers.get('x-group-id')
    const { searchParams } = new URL(request.url)
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
      // Get trip with days in single query with verification
      const trip = await prisma.trip.findFirst({
        where: { 
          id: id,
          groupId: groupId 
        },
        include: {
          tripDays: {
            orderBy: { dayNumber: 'asc' }
          }
        }
      })

      if (!trip) {
        return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
      }

      const tripDays = trip.tripDays

      const response = NextResponse.json({ tripDays })
      
      // Add cache headers with tags for revalidation
      const cacheHeaders = CacheManager.getCacheHeaders(
        CACHE_DURATIONS.TRIPS,
        [CACHE_TAGS.TRIP_DAYS(id), CACHE_TAGS.TRIP(id)]
      );
      
      Object.entries(cacheHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      response.headers.set('ETag', CacheManager.generateETag(`trip-days-${id}`));
      
      return response
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}