import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params

    // Verify trip exists
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true }
    })

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      )
    }

    // Delete the trip (cascade deletes will handle trip_days, events, expenses)
    await prisma.trip.delete({
      where: { id: tripId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting trip:', error)
    return NextResponse.json(
      { error: 'Failed to delete trip' },
      { status: 500 }
    )
  }
}