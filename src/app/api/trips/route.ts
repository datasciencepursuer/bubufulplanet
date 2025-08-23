import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { createAbsoluteDate, createAbsoluteDateRange, normalizeDate } from '@/lib/dateTimeUtils';
import { CACHE_TAGS, CACHE_DURATIONS, CacheManager } from '@/lib/cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, startDate, endDate, destination } = body;

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Name, start date, and end date are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get groupId from header or query params, fallback to user's first group
    const { searchParams } = new URL(request.url);
    const headerGroupId = request.headers.get('x-group-id');
    const queryGroupId = searchParams.get('groupId');
    const requestedGroupId = headerGroupId || queryGroupId;

    let groupId: string;

    if (requestedGroupId) {
      // Verify user is a member of the requested group
      const userGroup = await prisma.userGroup.findFirst({
        where: { 
          userId: user.id,
          groupId: requestedGroupId
        }
      });

      if (!userGroup) {
        return NextResponse.json({ error: 'Access denied to this group' }, { status: 403 });
      }
      
      groupId = requestedGroupId;
    } else {
      // Fallback to user's first group
      const userGroup = await prisma.userGroup.findFirst({
        where: { userId: user.id },
        include: { group: true }
      });

      if (!userGroup) {
        return NextResponse.json({ error: 'No group found' }, { status: 404 });
      }

      groupId = userGroup.groupId;
    }

    // Parse dates as absolute calendar dates (timezone-agnostic)
    const start = createAbsoluteDate(startDate);
    const end = createAbsoluteDate(endDate);

    // Create trip using Prisma
    const trip = await prisma.trip.create({
      data: {
        name,
        startDate: start,
        endDate: end,
        destination,
        groupId: groupId,
        userId: '' // Legacy field, set to empty string
      }
    });

      // Create trip_days for each day in the range using timezone-agnostic method
      const dateRange = createAbsoluteDateRange(start, end);
      const tripDays = dateRange.map((date, index) => ({
        tripId: trip.id,
        dayNumber: index + 1,
        date: date
      }));

      if (tripDays.length > 0) {
        try {
          await prisma.tripDay.createMany({
            data: tripDays
          });
        } catch (daysError) {
          console.error('Error creating trip days:', daysError);
          if (daysError instanceof Error) {
            console.error('Detailed days error:', {
              message: daysError.message,
              stack: daysError.stack,
              name: daysError.name
            });
          }
          // Trip was created but days failed - clean up
          await prisma.trip.delete({ where: { id: trip.id } });
          return NextResponse.json(
            { error: 'Failed to create trip days' },
            { status: 500 }
          );
        }
      }

      // Normalize date formats in response using timezone-agnostic method
      const normalizedTrip = {
        ...trip,
        startDate: normalizeDate(trip.startDate),
        endDate: normalizeDate(trip.endDate)
      };

    // Revalidate trips cache after creation
    CacheManager.revalidateTrips(groupId);

    return NextResponse.json({ trip: normalizedTrip }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Unexpected error in POST /api/trips:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get('id');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get groupId from header or query params, fallback to user's first group
    const headerGroupId = request.headers.get('x-group-id');
    const queryGroupId = searchParams.get('groupId');
    const requestedGroupId = headerGroupId || queryGroupId;

    let groupId: string;

    if (requestedGroupId) {
      // Verify user is a member of the requested group
      const userGroup = await prisma.userGroup.findFirst({
        where: { 
          userId: user.id,
          groupId: requestedGroupId
        }
      });

      if (!userGroup) {
        return NextResponse.json({ error: 'Access denied to this group' }, { status: 403 });
      }
      
      groupId = requestedGroupId;
    } else {
      // Fallback to user's first group
      const userGroup = await prisma.userGroup.findFirst({
        where: { userId: user.id },
        include: { group: true }
      });

      if (!userGroup) {
        return NextResponse.json({ error: 'No group found' }, { status: 404 });
      }

      groupId = userGroup.groupId;
    }

    let whereClause: any = {
      groupId: groupId
    };

    // If specific trip ID requested, add it to the filter
    if (tripId) {
      whereClause.id = tripId;
    }

    // Fetch trips filtered by group using Prisma
    const trips = await prisma.trip.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`GET trips: Found ${trips.length} trips for group ${groupId}:`, trips.map(t => ({ id: t.id, name: t.name, groupId: t.groupId })));

    // Normalize date formats to ensure consistency using timezone-agnostic method
    const normalizedTrips = trips.map(trip => ({
      ...trip,
      startDate: normalizeDate(trip.startDate),
      endDate: normalizeDate(trip.endDate)
    }));

    const response = NextResponse.json({ trips: normalizedTrips });
    
    // Add cache headers with tags for revalidation
    const cacheHeaders = CacheManager.getCacheHeaders(
      CACHE_DURATIONS.TRIPS,
      [CACHE_TAGS.TRIPS(groupId)]
    );
    
    Object.entries(cacheHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    response.headers.set('ETag', CacheManager.generateETag(`trips-${groupId}`));
    
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Unexpected error in GET /api/trips:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}