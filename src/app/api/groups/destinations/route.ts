import { NextRequest, NextResponse } from 'next/server';
import { withUnifiedSessionContext, requireUnifiedPermission } from '@/lib/unified-session';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { savedDestinations } = body;

    return await withUnifiedSessionContext(async (context) => {
      // Check modify permission
      requireUnifiedPermission(context, 'modify');

      // Update the travel group with saved destinations
      const updatedGroup = await prisma.travelGroup.update({
        where: {
          id: context.groupId
        },
        data: {
          savedDestinations,
          updatedAt: new Date()
        }
      });

      return NextResponse.json({ 
        success: true, 
        savedDestinations: updatedGroup.savedDestinations 
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Unexpected error in PUT /api/groups/destinations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}