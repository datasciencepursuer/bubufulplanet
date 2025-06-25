import { NextRequest, NextResponse } from 'next/server'
import { withUnifiedSessionContext } from '@/lib/unified-session'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get('tripId')
    
    if (!tripId) {
      return NextResponse.json({ error: 'Trip ID is required' }, { status: 400 })
    }

    return await withUnifiedSessionContext(async (context) => {
      // First verify the trip belongs to the user's group
      const trip = await prisma.trip.findFirst({
        where: {
          id: tripId,
          groupId: context.groupId
        }
      })

      if (!trip) {
        return NextResponse.json({ 
          error: 'Trip not found',
          details: 'Trip does not exist or you do not have access'
        }, { status: 404 })
      }

      // Get ALL expenses for this trip (both event-linked and standalone)
      const expenses = await prisma.expense.findMany({
        where: {
          tripId: tripId,
          groupId: context.groupId
        },
        include: {
          event: true,
          day: true,
          owner: true,
          participants: {
            include: {
              participant: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return NextResponse.json({ expenses })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Unexpected error in GET /api/events/expenses:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}