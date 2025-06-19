import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateUnifiedSession } from '@/lib/unified-session'
import { addDays, differenceInDays, format } from 'date-fns'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params
    
    // Validate session
    const validation = await validateUnifiedSession()
    if (!validation.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, destination, startDate, endDate } = body

    // Validate required fields
    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Trip name, start date, and end date are required' },
        { status: 400 }
      )
    }

    // Parse dates
    const start = new Date(startDate)
    const end = new Date(endDate)

    // Validate dates
    if (start >= end) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // Get existing trip
    const existingTrip = await prisma.trip.findUnique({
      where: { 
        id: tripId,
        groupId: validation.context!.groupId 
      },
      include: {
        tripDays: {
          orderBy: { date: 'asc' }
        }
      }
    })

    if (!existingTrip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      )
    }

    // Check if dates changed
    const oldStart = new Date(existingTrip.startDate)
    const oldEnd = new Date(existingTrip.endDate)
    const datesChanged = start.getTime() !== oldStart.getTime() || end.getTime() !== oldEnd.getTime()

    if (datesChanged) {
      // If dates changed, regenerate trip days
      await prisma.$transaction(async (tx) => {
        // Delete existing trip days (cascade will handle events and expenses)
        await tx.tripDay.deleteMany({
          where: { tripId }
        })

        // Update trip with new dates
        await tx.trip.update({
          where: { id: tripId },
          data: {
            name,
            destination,
            startDate: start,
            endDate: end,
            updatedAt: new Date()
          }
        })

        // Generate new trip days
        const days = differenceInDays(end, start)
        const tripDaysData = []
        
        for (let i = 0; i < days; i++) {
          const date = addDays(start, i)
          tripDaysData.push({
            tripId,
            date,
            dayNumber: i + 1,
            title: `Day ${i + 1}`,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }

        if (tripDaysData.length > 0) {
          await tx.tripDay.createMany({
            data: tripDaysData
          })
        }
      })
    } else {
      // If only name/destination changed, simple update
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          name,
          destination,
          updatedAt: new Date()
        }
      })
    }

    // Fetch updated trip
    const updatedTrip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        tripDays: {
          orderBy: { date: 'asc' }
        }
      }
    })

    return NextResponse.json({ 
      trip: updatedTrip,
      datesChanged 
    })
  } catch (error) {
    console.error('Error updating trip:', error)
    return NextResponse.json(
      { error: 'Failed to update trip' },
      { status: 500 }
    )
  }
}

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