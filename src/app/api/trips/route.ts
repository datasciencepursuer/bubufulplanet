import { NextRequest, NextResponse } from 'next/server';
import { withUnifiedSessionContext, requireUnifiedPermission } from '@/lib/unified-session';
import { prisma } from '@/lib/prisma';
import { createAbsoluteDate, createAbsoluteDateRange, normalizeDate } from '@/lib/dateTimeUtils';

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

    return await withUnifiedSessionContext(async (context) => {
      // Check create permission
      requireUnifiedPermission(context, 'create');

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
          groupId: context.groupId,
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

      return NextResponse.json({ trip: normalizedTrip }, { status: 201 });
    });
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

    return await withUnifiedSessionContext(async (context) => {
      let whereClause: any = {
        groupId: context.groupId
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
      });

      // Normalize date formats to ensure consistency using timezone-agnostic method
      const normalizedTrips = trips.map(trip => ({
        ...trip,
        startDate: normalizeDate(trip.startDate),
        endDate: normalizeDate(trip.endDate)
      }));

      const response = NextResponse.json({ trips: normalizedTrips });
      
      // Add cache headers for trip data
      response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600'); // 5 min cache, 10 min stale
      response.headers.set('ETag', `trips-${context.groupId}-${Date.now()}`);
      
      return response;
    });
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