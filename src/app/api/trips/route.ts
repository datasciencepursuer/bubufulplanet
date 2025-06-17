import { NextRequest, NextResponse } from 'next/server';
import { withUnifiedSessionContext, requireUnifiedPermission } from '@/lib/unified-session';
import { prisma } from '@/lib/prisma';
import { addDays, format } from 'date-fns';

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

      // Create trip using Prisma
      const trip = await prisma.trip.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          destination,
          groupId: context.groupId,
          userId: '' // Legacy field, set to empty string
        }
      });

      // Create trip_days for each day in the range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const tripDays = [];
      let dayNumber = 1;

      for (let date = start; date <= end; date = addDays(date, 1)) {
        tripDays.push({
          tripId: trip.id,
          dayNumber,
          date: new Date(date)
        });
        dayNumber++;
      }

      if (tripDays.length > 0) {
        try {
          await prisma.tripDay.createMany({
            data: tripDays
          });
        } catch (daysError) {
          console.error('Error creating trip days:', daysError);
          // Trip was created but days failed - clean up
          await prisma.trip.delete({ where: { id: trip.id } });
          return NextResponse.json(
            { error: 'Failed to create trip days' },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({ trip }, { status: 201 });
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

      return NextResponse.json({ trips });
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