import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get groupId from header or query params, fallback to user's first group
    const { searchParams } = new URL(request.url)
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
      // Get all expenses for trips in the user's group
      const expenses = await prisma.expense.findMany({
        where: {
          groupId: groupId
        },
        include: {
          event: {
            include: {
              day: true
            }
          },
          trip: {
            select: {
              id: true,
              name: true,
              destination: true
            }
          },
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
      });

      // Transform the data to include trip and event information
      const formattedExpenses = expenses.map(expense => ({
        id: expense.id,
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        eventId: expense.eventId,
        tripId: expense.tripId,
        eventTitle: expense.event?.title || null,
        tripName: expense.trip.name,
        tripDestination: expense.trip.destination || 'Unknown',
        eventDate: expense.event?.day?.date ? expense.event.day.date.toISOString().split('T')[0] : null,
        createdAt: expense.createdAt,
        owner: expense.owner,
        participants: expense.participants
      }));

      return NextResponse.json({ expenses: formattedExpenses });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Unexpected error in GET /api/expenses/all:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}