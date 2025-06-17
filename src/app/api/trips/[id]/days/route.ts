import { NextRequest, NextResponse } from 'next/server'
import { withUnifiedSessionContext } from '@/lib/unified-session'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    return await withUnifiedSessionContext(async (context) => {
      // Verify the trip belongs to the user's group
      const trip = await prisma.trip.findFirst({
        where: { 
          id: id,
          groupId: context.groupId 
        }
      })

      if (!trip) {
        return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
      }

      // Fetch trip days using Prisma
      const tripDays = await prisma.tripDay.findMany({
        where: { tripId: id },
        orderBy: { dayNumber: 'asc' }
      })

      return NextResponse.json({ tripDays })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}