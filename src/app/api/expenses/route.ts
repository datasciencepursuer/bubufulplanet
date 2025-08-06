import { NextRequest, NextResponse } from 'next/server';
import { withUnifiedSessionContext } from '@/lib/unified-session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { CacheManager } from '@/lib/cache';

// Validation schema for creating an expense
const createExpenseSchema = z.object({
  description: z.string().min(1).max(255),
  amount: z.number().positive(),
  category: z.string().max(100).optional(),
  ownerId: z.string().uuid(),
  tripId: z.string().uuid(),
  dayId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  participants: z.array(z.object({
    participantId: z.string().uuid().optional(),
    externalName: z.string().max(255).optional(),
    splitPercentage: z.number().min(0).max(100)
  })).min(1).optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1).max(255),
    amount: z.number().positive(),
    quantity: z.number().int().positive().default(1),
    category: z.string().max(100).optional(),
    participants: z.array(z.object({
      participantId: z.string().uuid().optional(),
      externalName: z.string().max(255).optional(),
      splitPercentage: z.number().min(0).max(100)
    })).min(1)
  })).optional()
});

export async function POST(request: NextRequest) {
  try {
    return await withUnifiedSessionContext(async (context) => {
      const body = await request.json();
      
      // Validate request body
      const validationResult = createExpenseSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Invalid request data', details: validationResult.error.flatten() },
          { status: 400 }
        );
      }

      const data = validationResult.data;

      // Verify the trip belongs to the user's group
      const trip = await prisma.trip.findFirst({
        where: {
          id: data.tripId,
          groupId: context.groupId
        }
      });

      if (!trip) {
        return NextResponse.json(
          { error: 'Trip not found or access denied' },
          { status: 404 }
        );
      }

      // Verify the owner is a member of the group
      const owner = await prisma.groupMember.findFirst({
        where: {
          id: data.ownerId,
          groupId: context.groupId
        }
      });

      if (!owner) {
        return NextResponse.json(
          { error: 'Owner must be a member of the group' },
          { status: 400 }
        );
      }

      // Verify all participant IDs belong to the group
      const participantIds = data.participants
        ? data.participants
            .filter(p => p.participantId)
            .map(p => p.participantId!)
        : [];

      if (participantIds.length > 0) {
        const validParticipants = await prisma.groupMember.findMany({
          where: {
            id: { in: participantIds },
            groupId: context.groupId
          }
        });

        if (validParticipants.length !== participantIds.length) {
          return NextResponse.json(
            { error: 'All participants must be members of the group' },
            { status: 400 }
          );
        }
      }

      // Verify percentages sum to 100 for participants (if using participant-level splitting)
      if (data.participants && !data.lineItems) {
        const totalPercentage = data.participants.reduce((sum, p) => sum + p.splitPercentage, 0);
        if (Math.abs(totalPercentage - 100) > 0.01) {
          return NextResponse.json(
            { error: 'Split percentages must sum to 100%' },
            { status: 400 }
          );
        }
      }

      // Verify line item percentages sum to 100
      if (data.lineItems) {
        for (const lineItem of data.lineItems) {
          const totalPercentage = lineItem.participants.reduce((sum, p) => sum + p.splitPercentage, 0);
          if (Math.abs(totalPercentage - 100) > 0.01) {
            return NextResponse.json(
              { error: `Line item "${lineItem.description}" split percentages must sum to 100%` },
              { status: 400 }
            );
          }
        }
      }

      // Verify dayId if provided
      if (data.dayId) {
        const day = await prisma.tripDay.findFirst({
          where: {
            id: data.dayId,
            tripId: data.tripId
          }
        });

        if (!day) {
          return NextResponse.json(
            { error: 'Invalid day for this trip' },
            { status: 400 }
          );
        }
      }

      // Helper function to handle external participants
      const handleExternalParticipant = async (name: string) => {
        let externalParticipant = await prisma.externalParticipant.findFirst({
          where: {
            groupId: context.groupId,
            name: name
          }
        });

        if (!externalParticipant) {
          externalParticipant = await prisma.externalParticipant.create({
            data: {
              groupId: context.groupId,
              name: name
            }
          });
        } else {
          // Update last used timestamp
          await prisma.externalParticipant.update({
            where: { id: externalParticipant.id },
            data: { lastUsedAt: new Date() }
          });
        }

        return externalParticipant;
      };

      // Handle external participants for expense-level splitting
      const participantsToCreate = [];
      if (data.participants && !data.lineItems) {
        for (const p of data.participants) {
          if (p.externalName && !p.participantId) {
            const externalParticipant = await handleExternalParticipant(p.externalName);
            participantsToCreate.push({
              participantId: p.participantId,
              externalParticipantId: externalParticipant.id,
              externalName: p.externalName,
              splitPercentage: p.splitPercentage,
              amountOwed: (data.amount * p.splitPercentage / 100)
            });
          } else {
            participantsToCreate.push({
              participantId: p.participantId,
              externalName: p.externalName,
              splitPercentage: p.splitPercentage,
              amountOwed: (data.amount * p.splitPercentage / 100)
            });
          }
        }
      }

      // Create the expense with participants or line items
      const expense = await prisma.expense.create({
        data: {
          description: data.description,
          amount: data.amount,
          category: data.category,
          ownerId: data.ownerId,
          tripId: data.tripId,
          dayId: data.dayId,
          eventId: data.eventId,
          groupId: context.groupId,
          participants: data.participants && !data.lineItems ? {
            create: participantsToCreate
          } : undefined,
          lineItems: data.lineItems ? {
            create: await Promise.all(data.lineItems.map(async (lineItem) => {
              const lineItemParticipants = [];
              for (const p of lineItem.participants) {
                if (p.externalName && !p.participantId) {
                  const externalParticipant = await handleExternalParticipant(p.externalName);
                  lineItemParticipants.push({
                    participantId: p.participantId,
                    externalParticipantId: externalParticipant.id,
                    externalName: p.externalName,
                    splitPercentage: p.splitPercentage,
                    amountOwed: (lineItem.amount * lineItem.quantity * p.splitPercentage / 100)
                  });
                } else {
                  lineItemParticipants.push({
                    participantId: p.participantId,
                    externalName: p.externalName,
                    splitPercentage: p.splitPercentage,
                    amountOwed: (lineItem.amount * lineItem.quantity * p.splitPercentage / 100)
                  });
                }
              }
              
              return {
                description: lineItem.description,
                amount: lineItem.amount,
                quantity: lineItem.quantity || 1,
                category: lineItem.category,
                participants: {
                  create: lineItemParticipants
                }
              };
            }))
          } : undefined
        },
        include: {
          owner: true,
          participants: {
            include: {
              participant: true,
              externalParticipant: true
            }
          },
          lineItems: {
            include: {
              participants: {
                include: {
                  participant: true,
                  externalParticipant: true
                }
              }
            }
          },
          trip: true,
          day: true,
          event: true
        }
      });

      // Revalidate expense caches after creation
      CacheManager.revalidateExpenses(data.tripId, context.groupId);

      return NextResponse.json({ expense });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Unexpected error in POST /api/expenses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
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

      const expenses = await prisma.expense.findMany({
        where,
        include: {
          owner: true,
          participants: {
            include: {
              participant: true,
              externalParticipant: true
            }
          },
          lineItems: {
            include: {
              participants: {
                include: {
                  participant: true,
                  externalParticipant: true
                }
              }
            }
          },
          trip: true,
          day: true,
          event: true
        },
        orderBy: [
          { day: { date: 'desc' } },
          { createdAt: 'desc' }
        ]
      });

      return NextResponse.json({ expenses });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Unexpected error in GET /api/expenses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}