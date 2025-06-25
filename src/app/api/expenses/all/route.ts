import { NextRequest, NextResponse } from 'next/server';
import { withUnifiedSessionContext } from '@/lib/unified-session';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    return await withUnifiedSessionContext(async (context) => {
      // Get all expenses for trips in the user's group
      const expenses = await prisma.expense.findMany({
        where: {
          groupId: context.groupId
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
    });
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