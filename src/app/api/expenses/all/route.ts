import { NextRequest, NextResponse } from 'next/server';
import { withUnifiedSessionContext } from '@/lib/unified-session';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    return await withUnifiedSessionContext(async (context) => {
      // Get all expenses for trips in the user's group
      const expenses = await prisma.expense.findMany({
        where: {
          event: {
            day: {
              trip: {
                groupId: context.groupId
              }
            }
          }
        },
        include: {
          event: {
            include: {
              day: {
                include: {
                  trip: {
                    select: {
                      id: true,
                      name: true,
                      destination: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Transform the data to include trip and event information
      const formattedExpenses = expenses
        .filter(expense => expense.event && expense.event.day && expense.event.day.trip)
        .map(expense => ({
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          eventId: expense.eventId,
          tripId: expense.event!.day.trip.id,
          eventTitle: expense.event!.title,
          tripName: expense.event!.day.trip.name,
          tripDestination: expense.event!.day.trip.destination || 'Unknown',
          eventDate: expense.event!.day.date.toISOString().split('T')[0]
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