import { NextRequest, NextResponse } from 'next/server';
import { withUnifiedSessionContext } from '@/lib/unified-session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for updating an expense
const updateExpenseSchema = z.object({
  description: z.string().min(1).max(255).optional(),
  amount: z.number().positive().optional(),
  category: z.string().max(100).optional().nullable(),
  ownerId: z.string().uuid().optional(),
  dayId: z.string().uuid().optional().nullable(),
  eventId: z.string().uuid().optional().nullable(),
  participants: z.array(z.object({
    participantId: z.string().uuid().optional(),
    externalName: z.string().max(255).optional(),
    splitPercentage: z.number().min(0).max(100)
  })).min(1).optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return await withUnifiedSessionContext(async (context) => {
      const expense = await prisma.expense.findFirst({
        where: {
          id: id,
          groupId: context.groupId
        },
        include: {
          owner: true,
          participants: {
            include: {
              participant: true
            }
          },
          trip: true,
          day: true,
          event: true
        }
      });

      if (!expense) {
        return NextResponse.json(
          { error: 'Expense not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ expense });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Unexpected error in GET /api/expenses/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return await withUnifiedSessionContext(async (context) => {
      const body = await request.json();
      
      // Validate request body
      const validationResult = updateExpenseSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Invalid request data', details: validationResult.error.flatten() },
          { status: 400 }
        );
      }

      const data = validationResult.data;

      // Find the expense
      const expense = await prisma.expense.findFirst({
        where: {
          id: id,
          groupId: context.groupId
        },
        include: {
          trip: true
        }
      });

      if (!expense) {
        return NextResponse.json(
          { error: 'Expense not found' },
          { status: 404 }
        );
      }

      // Verify new owner if provided
      if (data.ownerId) {
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
      }

      // Verify participants if provided
      if (data.participants) {
        // Verify all participant IDs belong to the group
        const participantIds = data.participants
          .filter(p => p.participantId)
          .map(p => p.participantId!);

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

        // Verify percentages sum to 100
        const totalPercentage = data.participants.reduce((sum, p) => sum + p.splitPercentage, 0);
        if (Math.abs(totalPercentage - 100) > 0.01) {
          return NextResponse.json(
            { error: 'Split percentages must sum to 100%' },
            { status: 400 }
          );
        }
      }

      // Verify dayId if provided
      if (data.dayId !== undefined) {
        if (data.dayId) {
          const day = await prisma.tripDay.findFirst({
            where: {
              id: data.dayId,
              tripId: expense.tripId
            }
          });

          if (!day) {
            return NextResponse.json(
              { error: 'Invalid day for this trip' },
              { status: 400 }
            );
          }
        }
      }

      // Update the expense
      const updatedExpense = await prisma.$transaction(async (tx) => {
        // Update expense fields
        const updated = await tx.expense.update({
          where: { id: id },
          data: {
            description: data.description,
            amount: data.amount,
            category: data.category,
            ownerId: data.ownerId,
            dayId: data.dayId,
            eventId: data.eventId
          }
        });

        // Update participants if provided
        if (data.participants) {
          // Delete existing participants
          await tx.expenseParticipant.deleteMany({
            where: { expenseId: id }
          });

          // Create new participants
          const amount = data.amount || expense.amount;
          await tx.expenseParticipant.createMany({
            data: data.participants.map(p => ({
              expenseId: id,
              participantId: p.participantId,
              externalName: p.externalName,
              splitPercentage: p.splitPercentage,
              amountOwed: Number(amount) * p.splitPercentage / 100
            }))
          });
        }

        // Fetch and return the updated expense with relations
        return await tx.expense.findUnique({
          where: { id: id },
          include: {
            owner: true,
            participants: {
              include: {
                participant: true
              }
            },
            trip: true,
            day: true,
            event: true
          }
        });
      });

      return NextResponse.json({ expense: updatedExpense });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Unexpected error in PUT /api/expenses/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return await withUnifiedSessionContext(async (context) => {
      // Find the expense
      const expense = await prisma.expense.findFirst({
        where: {
          id: id,
          groupId: context.groupId
        }
      });

      if (!expense) {
        return NextResponse.json(
          { error: 'Expense not found' },
          { status: 404 }
        );
      }

      // Delete the expense (participants will be cascade deleted)
      await prisma.expense.delete({
        where: { id: id }
      });

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Unexpected error in DELETE /api/expenses/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}