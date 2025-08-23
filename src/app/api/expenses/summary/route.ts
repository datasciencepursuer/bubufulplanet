import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
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
      const tripId = searchParams.get('tripId');

      // Build where clause
      const where: any = {
        groupId: groupId
      };

      if (tripId) {
        where.tripId = tripId;
      }

      // Get expenses with all related data including group members through relations
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
        where: { groupId: userGroup.groupId }
      });

      // Calculate balances
      const balances = calculateGroupBalances(expenses, groupMembers);

      // Get trip info if filtering by trip
      let tripInfo = null;
      if (tripId) {
        tripInfo = await prisma.trip.findFirst({
          where: {
            id: tripId,
            groupId: userGroup.groupId
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