import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Fetch trip days using Prisma
    const tripDays = await prisma.tripDay.findMany({
      where: { tripId: id },
      orderBy: { dayNumber: 'asc' }
    })

    return NextResponse.json({ tripDays })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}