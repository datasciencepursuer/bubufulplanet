import { NextRequest, NextResponse } from 'next/server';
import { withUnifiedSessionContext } from '@/lib/unified-session';
import { prisma } from '@/lib/prisma';

interface TripExpenseSummary {
  tripId: string;
  tripName: string;
  tripDestination: string | null;
  totalExpenses: number;
  yourShare: number;
  youOwe: number;
  owedToYou: number;
}

interface PersonalExpenseSummary {
  currentMemberId: string;
  currentMemberName: string;
  totalExpensesAcrossAllTrips: number;
  totalYouOwe: number;
  totalOwedToYou: number;
  netBalance: number;
  tripBreakdowns: TripExpenseSummary[];
  peopleYouOwe: {
    memberId: string;
    memberName: string;
    amount: number;
    trips: { tripId: string; tripName: string; amount: number }[];
  }[];
  peopleWhoOweYou: {
    memberId: string;
    memberName: string;
    amount: number;
    trips: { tripId: string; tripName: string; amount: number }[];
  }[];
}

export async function GET(request: NextRequest) {
  try {
    return await withUnifiedSessionContext(async (context) => {
      // Get current member using traveler name from session
      const currentMember = await prisma.groupMember.findFirst({
        where: {
          groupId: context.groupId,
          travelerName: context.travelerName
        }
      });

      if (!currentMember) {
        console.error('Member not found for context:', {
          groupId: context.groupId,
          travelerName: context.travelerName
        });
        return NextResponse.json({ 
          error: 'Member not found',
          details: `No member found with traveler name: ${context.travelerName}`
        }, { status: 404 });
      }
      
      console.log('Found current member:', {
        id: currentMember.id,
        travelerName: currentMember.travelerName,
        role: currentMember.role
      });

      // Get trips and expenses in parallel to reduce database round trips
      const [trips, expenses] = await Promise.all([
        prisma.trip.findMany({
          where: { groupId: context.groupId },
          orderBy: { startDate: 'desc' }
        }),
        prisma.expense.findMany({
          where: { groupId: context.groupId },
          include: {
            owner: true,
            participants: {
              include: {
                participant: true
              }
            },
            trip: true
          }
        })
      ]);

      // Calculate per-trip summaries
      const tripBreakdowns: TripExpenseSummary[] = [];
      const owingsMap = new Map<string, Map<string, Map<string, number>>>(); // owerId -> ownerId -> tripId -> amount

      for (const trip of trips) {
        const tripExpenses = expenses.filter(e => e.tripId === trip.id);
        const totalExpenses = tripExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        
        let yourShare = 0;
        let youOwe = 0;
        let owedToYou = 0;

        for (const expense of tripExpenses) {
          // Calculate what current member paid
          if (expense.ownerId === currentMember.id) {
            yourShare += Number(expense.amount);
            
            // Calculate what others owe to current member
            for (const participant of expense.participants) {
              if (participant.participantId && participant.participantId !== currentMember.id) {
                owedToYou += Number(participant.amountOwed);
              }
            }
          }

          // Calculate what current member owes
          for (const participant of expense.participants) {
            if (participant.participantId === currentMember.id && expense.ownerId !== currentMember.id) {
              youOwe += Number(participant.amountOwed);
              
              // Track who we owe and for which trip
              const ownerId = expense.ownerId;
              if (!owingsMap.has(currentMember.id)) {
                owingsMap.set(currentMember.id, new Map());
              }
              const memberOwings = owingsMap.get(currentMember.id)!;
              
              if (!memberOwings.has(ownerId)) {
                memberOwings.set(ownerId, new Map());
              }
              const ownerOwings = memberOwings.get(ownerId)!;
              
              const currentAmount = ownerOwings.get(trip.id) || 0;
              ownerOwings.set(trip.id, currentAmount + Number(participant.amountOwed));
            }
          }
        }

        tripBreakdowns.push({
          tripId: trip.id,
          tripName: trip.name,
          tripDestination: trip.destination,
          totalExpenses,
          yourShare,
          youOwe,
          owedToYou
        });
      }

      // Calculate who owes whom across all trips
      const peopleYouOweMap = new Map<string, { 
        memberName: string; 
        total: number; 
        trips: Map<string, { name: string; amount: number }> 
      }>();
      
      const peopleWhoOweYouMap = new Map<string, { 
        memberName: string; 
        total: number; 
        trips: Map<string, { name: string; amount: number }> 
      }>();

      // Process what current member owes
      for (const expense of expenses) {
        for (const participant of expense.participants) {
          if (participant.participantId === currentMember.id && expense.ownerId !== currentMember.id) {
            const ownerId = expense.ownerId;
            const ownerName = expense.owner.travelerName;
            const amount = Number(participant.amountOwed);
            const tripName = expense.trip.name;

            if (!peopleYouOweMap.has(ownerId)) {
              peopleYouOweMap.set(ownerId, {
                memberName: ownerName,
                total: 0,
                trips: new Map()
              });
            }

            const ownerData = peopleYouOweMap.get(ownerId)!;
            ownerData.total += amount;
            
            const currentTripAmount = ownerData.trips.get(expense.tripId) || { name: tripName, amount: 0 };
            currentTripAmount.amount += amount;
            ownerData.trips.set(expense.tripId, currentTripAmount);
          }
        }
      }

      // Process what others owe to current member
      for (const expense of expenses) {
        if (expense.ownerId === currentMember.id) {
          for (const participant of expense.participants) {
            if (participant.participantId && participant.participantId !== currentMember.id) {
              const owerId = participant.participantId;
              const owerName = participant.participant?.travelerName || 'Unknown';
              const amount = Number(participant.amountOwed);
              const tripName = expense.trip.name;

              if (!peopleWhoOweYouMap.has(owerId)) {
                peopleWhoOweYouMap.set(owerId, {
                  memberName: owerName,
                  total: 0,
                  trips: new Map()
                });
              }

              const owerData = peopleWhoOweYouMap.get(owerId)!;
              owerData.total += amount;
              
              const currentTripAmount = owerData.trips.get(expense.tripId) || { name: tripName, amount: 0 };
              currentTripAmount.amount += amount;
              owerData.trips.set(expense.tripId, currentTripAmount);
            }
          }
        }
      }

      // Convert maps to arrays
      const peopleYouOwe = Array.from(peopleYouOweMap.entries())
        .map(([memberId, data]) => ({
          memberId,
          memberName: data.memberName,
          amount: data.total,
          trips: Array.from(data.trips.entries()).map(([tripId, tripData]) => ({
            tripId,
            tripName: tripData.name,
            amount: tripData.amount
          }))
        }))
        .sort((a, b) => b.amount - a.amount);

      const peopleWhoOweYou = Array.from(peopleWhoOweYouMap.entries())
        .map(([memberId, data]) => ({
          memberId,
          memberName: data.memberName,
          amount: data.total,
          trips: Array.from(data.trips.entries()).map(([tripId, tripData]) => ({
            tripId,
            tripName: tripData.name,
            amount: tripData.amount
          }))
        }))
        .sort((a, b) => b.amount - a.amount);

      // Calculate totals
      const totalYouOwe = peopleYouOwe.reduce((sum, p) => sum + p.amount, 0);
      const totalOwedToYou = peopleWhoOweYou.reduce((sum, p) => sum + p.amount, 0);

      const summary: PersonalExpenseSummary = {
        currentMemberId: currentMember.id,
        currentMemberName: currentMember.travelerName,
        totalExpensesAcrossAllTrips: expenses.reduce((sum, e) => sum + Number(e.amount), 0),
        totalYouOwe,
        totalOwedToYou,
        netBalance: totalOwedToYou - totalYouOwe,
        tripBreakdowns: tripBreakdowns.filter(t => t.totalExpenses > 0),
        peopleYouOwe,
        peopleWhoOweYou
      };

      return NextResponse.json(summary);
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Unexpected error in GET /api/expenses/personal-summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}