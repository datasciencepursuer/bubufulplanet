import { NextRequest, NextResponse } from 'next/server'
import { withUnifiedSessionContext } from '@/lib/unified-session'
import { prisma } from '@/lib/prisma'
import { CACHE_TAGS, CACHE_DURATIONS, CacheManager } from '@/lib/cache'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    return await withUnifiedSessionContext(async (context) => {
      // Get trip with days in single query with verification
      const trip = await prisma.trip.findFirst({
        where: { 
          id: id,
          groupId: context.groupId 
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
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}