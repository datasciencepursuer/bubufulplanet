import { NextRequest, NextResponse } from 'next/server';
import { withSessionContext, requirePermission } from '@/lib/supabase/session';
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

    return await withSessionContext(async (context, supabase) => {
      // Check create permission
      requirePermission(context, 'create');

      // Create trip with group_id
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .insert({
          name,
          start_date: startDate,
          end_date: endDate,
          destination,
          group_id: context.groupId,
          user_id: null // No longer using user_id for group trips
        })
        .select()
        .single();

      if (tripError) {
        console.error('Error creating trip:', tripError);
        return NextResponse.json(
          { error: 'Failed to create trip' },
          { status: 500 }
        );
      }

      // Create trip_days for each day in the range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const tripDays = [];
      let dayNumber = 1;

      for (let date = start; date <= end; date = addDays(date, 1)) {
        tripDays.push({
          trip_id: trip.id,
          day_number: dayNumber,
          date: format(date, 'yyyy-MM-dd')
        });
        dayNumber++;
      }

      if (tripDays.length > 0) {
        const { error: daysError } = await supabase
          .from('trip_days')
          .insert(tripDays);

        if (daysError) {
          console.error('Error creating trip days:', daysError);
          // Trip was created but days failed - clean up
          await supabase.from('trips').delete().eq('id', trip.id);
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
    return await withSessionContext(async (context, supabase) => {
      // Manually filter by group_id to ensure proper isolation
      const { data: trips, error } = await supabase
        .from('trips')
        .select('*')
        .eq('group_id', context.groupId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching trips:', error);
        return NextResponse.json(
          { error: 'Failed to fetch trips' },
          { status: 500 }
        );
      }

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