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
  })).min(1).optional(),
  lineItems: z.array(z.object({
    id: z.string().uuid().optional(), // For updates
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

      // Verify participants if provided (expense-level splitting)
      if (data.participants && !data.lineItems) {
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

      // Verify line items and their participants if provided
      if (data.lineItems) {
        for (const lineItem of data.lineItems) {
          // Verify all participant IDs belong to the group
          const participantIds = lineItem.participants
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
                { error: `All participants in line item "${lineItem.description}" must be members of the group` },
                { status: 400 }
              );
            }
          }

          // Verify percentages sum to 100
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

        // Helper function to handle external participants
        const handleExternalParticipant = async (name: string) => {
          let externalParticipant = await tx.externalParticipant.findFirst({
            where: {
              groupId: context.groupId,
              name: name
            }
          });

          if (!externalParticipant) {
            externalParticipant = await tx.externalParticipant.create({
              data: {
                groupId: context.groupId,
                name: name
              }
            });
          } else {
            // Update last used timestamp
            await tx.externalParticipant.update({
              where: { id: externalParticipant.id },
              data: { lastUsedAt: new Date() }
            });
          }

          return externalParticipant;
        };

        // Update participants if provided (expense-level splitting)
        if (data.participants && !data.lineItems) {
          // Delete existing participants
          await tx.expenseParticipant.deleteMany({
            where: { expenseId: id }
          });

          // Handle external participants - create or find existing ones
          const participantsToCreate = [];
          for (const p of data.participants) {
            if (p.externalName && !p.participantId) {
              const externalParticipant = await handleExternalParticipant(p.externalName);
              participantsToCreate.push({
                expenseId: id,
                participantId: p.participantId,
                externalParticipantId: externalParticipant.id,
                externalName: p.externalName,
                splitPercentage: p.splitPercentage,
                amountOwed: Number(data.amount || expense.amount) * p.splitPercentage / 100
              });
            } else {
              participantsToCreate.push({
                expenseId: id,
                participantId: p.participantId,
                externalName: p.externalName,
                splitPercentage: p.splitPercentage,
                amountOwed: Number(data.amount || expense.amount) * p.splitPercentage / 100
              });
            }
          }

          // Create new participants
          await tx.expenseParticipant.createMany({
            data: participantsToCreate
          });
        }

        // Update line items if provided
        if (data.lineItems) {
          // Delete existing participants and line items
          await tx.expenseParticipant.deleteMany({
            where: { expenseId: id }
          });
          await tx.expenseLineItem.deleteMany({
            where: { expenseId: id }
          });

          // Create new line items
          for (const lineItem of data.lineItems) {
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
            
            await tx.expenseLineItem.create({
              data: {
                expenseId: id,
                description: lineItem.description,
                amount: lineItem.amount,
                quantity: lineItem.quantity || 1,
                category: lineItem.category,
                participants: {
                  create: lineItemParticipants
                }
              }
            });
          }
        }

        // Fetch and return the updated expense with relations
        return await tx.expense.findUnique({
          where: { id: id },
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