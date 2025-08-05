import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateUnifiedSession } from '@/lib/unified-session'
import { createAbsoluteDate, createAbsoluteDateRange, normalizeDate } from '@/lib/dateTimeUtils'
import { CacheManager } from '@/lib/cache'

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

    // Parse dates as absolute calendar dates (timezone-agnostic)
    const start = createAbsoluteDate(startDate);
    const end = createAbsoluteDate(endDate);

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

    // Check if dates changed using timezone-agnostic comparison
    const oldStartNormalized = normalizeDate(existingTrip.startDate)
    const oldEndNormalized = normalizeDate(existingTrip.endDate)
    const datesChanged = startDate !== oldStartNormalized || endDate !== oldEndNormalized

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

        // Generate new trip days using timezone-agnostic method
        const dateRange = createAbsoluteDateRange(start, end);
        const tripDaysData = dateRange.map((date, index) => ({
          tripId,
          date: date,
          dayNumber: index + 1
        }));

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

    // Normalize date formats in response using timezone-agnostic method
    const normalizedTrip = updatedTrip ? {
      ...updatedTrip,
      startDate: normalizeDate(updatedTrip.startDate),
      endDate: normalizeDate(updatedTrip.endDate),
      tripDays: updatedTrip.tripDays.map(day => ({
        ...day,
        date: normalizeDate(day.date)
      }))
    } : null

    // Revalidate caches after trip update
    CacheManager.revalidateTrip(tripId, validation.context!.groupId);
    
    // If dates changed, also revalidate events since trip days were regenerated
    if (datesChanged) {
      CacheManager.revalidateEvents(tripId, validation.context!.groupId);
    }

    return NextResponse.json({ 
      trip: normalizedTrip,
      datesChanged 
    })
  } catch (error) {
    console.error('Error updating trip:', error)
    
    // Provide more specific error information
    let errorMessage = 'Failed to update trip'
    if (error instanceof Error) {
      errorMessage = error.message
      console.error('Detailed error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
    }
    
    return NextResponse.json(
      { error: errorMessage },
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

    // Validate session and get group info for cache revalidation
    const validation = await validateUnifiedSession()
    if (!validation.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify trip exists and belongs to group
    const trip = await prisma.trip.findFirst({
      where: { 
        id: tripId,
        groupId: validation.context!.groupId 
      },
      select: { id: true, groupId: true }
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

    // Revalidate all related caches after deletion
    CacheManager.revalidateTrip(tripId, validation.context!.groupId);
    CacheManager.revalidateEvents(tripId, validation.context!.groupId);
    CacheManager.revalidateExpenses(tripId, validation.context!.groupId);

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting trip:', error)
    return NextResponse.json(
      { error: 'Failed to delete trip' },
      { status: 500 }
    )
  }
}