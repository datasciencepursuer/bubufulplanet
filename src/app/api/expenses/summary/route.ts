import { NextRequest, NextResponse } from 'next/server';
import { withUnifiedSessionContext } from '@/lib/unified-session';
import { prisma } from '@/lib/prisma';

interface BalanceSummary {
  memberId: string;
  memberName: string;
  totalOwed: number;
  totalOwing: number;
  netBalance: number;
  balancesWith: {
    memberId: string;
    memberName: string;
    amount: number; // positive = they owe you, negative = you owe them
  }[];
}

export async function GET(request: NextRequest) {
  try {
    return await withUnifiedSessionContext(async (context) => {
      const { searchParams } = new URL(request.url);
      const tripId = searchParams.get('tripId');

      // Build where clause
      const where: any = {
        groupId: context.groupId
      };

      if (tripId) {
        where.tripId = tripId;
      }

      // Get all expenses with participants
      const expenses = await prisma.expense.findMany({
        where,
        include: {
          owner: true,
          participants: {
            include: {
              participant: true
            }
          }
        }
      });

      // Get all group members
      const groupMembers = await prisma.groupMember.findMany({
        where: { groupId: context.groupId }
      });

      // Calculate balances
      const balances = calculateGroupBalances(expenses, groupMembers);

      // Get trip info if filtering by trip
      let tripInfo = null;
      if (tripId) {
        tripInfo = await prisma.trip.findFirst({
          where: {
            id: tripId,
            groupId: context.groupId
          },
          select: {
            id: true,
            name: true,
            destination: true,
            startDate: true,
            endDate: true
          }
        });
      }

      return NextResponse.json({ 
        balances,
        trip: tripInfo,
        totalExpenses: expenses.reduce((sum, e) => sum + Number(e.amount), 0)
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Unexpected error in GET /api/expenses/summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateGroupBalances(expenses: any[], groupMembers: any[]): BalanceSummary[] {
  // Initialize balance tracking
  const memberMap = new Map(groupMembers.map(m => [m.id, m.travelerName]));
  const owings = new Map<string, Map<string, number>>();

  // Initialize all members
  for (const member of groupMembers) {
    owings.set(member.id, new Map());
  }

  // Calculate who owes whom
  for (const expense of expenses) {
    for (const participant of expense.participants) {
      // Skip if the participant is the owner (can't owe yourself)
      if (participant.participantId === expense.ownerId) continue;

      const owerId = participant.participantId;
      const ownerId = expense.ownerId;
      const amount = Number(participant.amountOwed);

      if (owerId && memberMap.has(owerId)) {
        const owerBalances = owings.get(owerId)!;
        const currentOwed = owerBalances.get(ownerId) || 0;
        owerBalances.set(ownerId, currentOwed + amount);
      }
    }
  }

  // Calculate net balances
  const summaries: BalanceSummary[] = [];

  for (const member of groupMembers) {
    const memberId = member.id;
    const memberOwings = owings.get(memberId)!;
    
    let totalOwed = 0;
    let totalOwing = 0;
    const balancesWith: BalanceSummary['balancesWith'] = [];

    // Calculate what this member owes to others
    for (const [ownerId, amount] of memberOwings) {
      if (amount > 0) {
        totalOwing += amount;
      }
    }

    // Calculate what others owe to this member
    for (const [otherId, otherOwings] of owings) {
      if (otherId === memberId) continue;
      
      const amountOwedToMe = otherOwings.get(memberId) || 0;
      if (amountOwedToMe > 0) {
        totalOwed += amountOwedToMe;
      }

      // Calculate net balance with this specific person
      const iOweThisPersonn = memberOwings.get(otherId) || 0;
      const theyOweMe = amountOwedToMe;
      const netWithPerson = theyOweMe - iOweThisPersonn;

      if (Math.abs(netWithPerson) > 0.01) {
        balancesWith.push({
          memberId: otherId,
          memberName: memberMap.get(otherId) || 'Unknown',
          amount: netWithPerson
        });
      }
    }

    summaries.push({
      memberId,
      memberName: member.travelerName,
      totalOwed,
      totalOwing,
      netBalance: totalOwed - totalOwing,
      balancesWith: balancesWith.sort((a, b) => b.amount - a.amount)
    });
  }

  return summaries;
}