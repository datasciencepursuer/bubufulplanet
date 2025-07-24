import { NextRequest, NextResponse } from 'next/server';
import { withUnifiedSessionContext } from '@/lib/unified-session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for creating an external participant
const createExternalParticipantSchema = z.object({
  name: z.string().min(1).max(255).trim()
});

export async function GET(request: NextRequest) {
  try {
    return await withUnifiedSessionContext(async (context) => {
      const externalParticipants = await prisma.externalParticipant.findMany({
        where: {
          groupId: context.groupId
        },
        orderBy: [
          { lastUsedAt: 'desc' },
          { name: 'asc' }
        ]
      });

      return NextResponse.json({ externalParticipants });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Unexpected error in GET /api/external-participants:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withUnifiedSessionContext(async (context) => {
      const body = await request.json();
      
      // Validate request body
      const validationResult = createExternalParticipantSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Invalid request data', details: validationResult.error.flatten() },
          { status: 400 }
        );
      }

      const data = validationResult.data;

      // Check if external participant already exists
      const existingParticipant = await prisma.externalParticipant.findFirst({
        where: {
          groupId: context.groupId,
          name: data.name
        }
      });

      if (existingParticipant) {
        // Update last used timestamp
        const updatedParticipant = await prisma.externalParticipant.update({
          where: { id: existingParticipant.id },
          data: { lastUsedAt: new Date() }
        });
        
        return NextResponse.json({ externalParticipant: updatedParticipant });
      }

      // Create new external participant
      const externalParticipant = await prisma.externalParticipant.create({
        data: {
          groupId: context.groupId,
          name: data.name
        }
      });

      return NextResponse.json({ externalParticipant });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Unexpected error in POST /api/external-participants:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}