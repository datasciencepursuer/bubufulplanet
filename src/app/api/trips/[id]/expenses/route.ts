import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's current group
    const userGroup = await prisma.userGroup.findFirst({
      where: { userId: user.id },
      include: { group: true }
    })

    if (!userGroup) {
      return NextResponse.json({ error: 'No group found' }, { status: 404 })
    }
      // Get trip and expenses in single query with verification
      const trip = await prisma.trip.findFirst({
        where: {
          id: id,
          groupId: userGroup.groupId
        },
        include: {
          expenses: {
            include: {
              owner: true,
              participants: {
                include: {
                  participant: true
                }
              },
              day: true,
              event: true
            },
            orderBy: [
              { day: { date: 'asc' } },
              { createdAt: 'asc' }
            ]
          }
        }
      });

      if (!trip) {
        return NextResponse.json(
          { error: 'Trip not found or access denied' },
          { status: 404 }
        );
      }

      const expenses = trip.expenses;

      // Group expenses by day
      const expensesByDay = expenses.reduce((acc, expense) => {
        const dayId = expense.dayId || 'trip-level';
        if (!acc[dayId]) {
          acc[dayId] = {
            dayId,
            date: expense.day?.date,
            dayNumber: expense.day?.dayNumber,
            expenses: []
          };
        }
        acc[dayId].expenses.push(expense);
        return acc;
      }, {} as Record<string, any>);

      // Calculate totals
      const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const totalByCategory = expenses.reduce((acc, expense) => {
        const category = expense.category || 'Uncategorized';
        acc[category] = (acc[category] || 0) + Number(expense.amount);
        return acc;
      }, {} as Record<string, number>);

      return NextResponse.json({ 
        trip: {
          id: trip.id,
          name: trip.name,
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate
        },
        expenses,
        expensesByDay: Object.values(expensesByDay),
        summary: {
          total: totalAmount,
          byCategory: totalByCategory,
          count: expenses.length
        }
      });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Unexpected error in GET /api/trips/[id]/expenses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}