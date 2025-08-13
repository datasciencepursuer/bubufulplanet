import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for creating an external participant
const createExternalParticipantSchema = z.object({
  name: z.string().min(1).max(255).trim()
});

export async function GET(request: NextRequest) {
  try {
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
      const externalParticipants = await prisma.externalParticipant.findMany({
        where: {
          groupId: userGroup.groupId
        },
        orderBy: [
          { lastUsedAt: 'desc' },
          { name: 'asc' }
        ]
      });

      return NextResponse.json({ externalParticipants });
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
          groupId: userGroup.groupId,
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
          groupId: userGroup.groupId,
          name: data.name
        }
      });

      return NextResponse.json({ externalParticipant });
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