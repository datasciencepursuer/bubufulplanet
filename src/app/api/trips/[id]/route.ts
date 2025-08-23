import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { createAbsoluteDate, createAbsoluteDateRange, normalizeDate } from '@/lib/dateTimeUtils'
import { CacheManager } from '@/lib/cache'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params
    
    // Validate session
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
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

    // Get groupId from header or query params, fallback to user's first group
    const { searchParams } = new URL(request.url)
    const headerGroupId = request.headers.get('x-group-id')
    const queryGroupId = searchParams.get('groupId')
    const requestedGroupId = headerGroupId || queryGroupId

    let groupId: string

    if (requestedGroupId) {
      // Verify user is a member of the requested group
      const userGroup = await prisma.userGroup.findFirst({
        where: { 
          userId: user.id,
          groupId: requestedGroupId
        }
      })

      if (!userGroup) {
        return NextResponse.json({ error: 'Access denied to this group' }, { status: 403 })
      }
      
      groupId = requestedGroupId
    } else {
      // Fallback to user's first group
      const userGroup = await prisma.userGroup.findFirst({
        where: { userId: user.id },
        include: { group: true }
      })

      if (!userGroup) {
        return NextResponse.json({ error: 'No group found' }, { status: 404 })
      }

      groupId = userGroup.groupId
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
        groupId: groupId 
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
    CacheManager.revalidateTrip(tripId, groupId);
    
    // If dates changed, also revalidate events since trip days were regenerated
    if (datesChanged) {
      CacheManager.revalidateEvents(tripId, groupId);
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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get groupId from header or query params, fallback to user's first group
    const { searchParams } = new URL(request.url)
    const headerGroupId = request.headers.get('x-group-id')
    const queryGroupId = searchParams.get('groupId')
    const requestedGroupId = headerGroupId || queryGroupId

    let groupId: string

    if (requestedGroupId) {
      // Verify user is a member of the requested group
      const userGroup = await prisma.userGroup.findFirst({
        where: { 
          userId: user.id,
          groupId: requestedGroupId
        }
      })

      if (!userGroup) {
        return NextResponse.json({ error: 'Access denied to this group' }, { status: 403 })
      }
      
      groupId = requestedGroupId
    } else {
      // Fallback to user's first group
      const userGroup = await prisma.userGroup.findFirst({
        where: { userId: user.id },
        include: { group: true }
      })

      if (!userGroup) {
        return NextResponse.json({ error: 'No group found' }, { status: 404 })
      }

      groupId = userGroup.groupId
    }

    // First check if trip exists at all
    const tripExists = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, groupId: true }
    })

    if (!tripExists) {
      console.error(`DELETE: Trip ${tripId} does not exist in database`)
      return NextResponse.json(
        { error: 'Trip not found in database' },
        { status: 404 }
      )
    }

    // Then verify trip belongs to user's group
    if (tripExists.groupId !== groupId) {
      console.error(`DELETE: Trip ${tripId} belongs to group ${tripExists.groupId} but user is in group ${groupId}`)
      return NextResponse.json(
        { error: 'Trip not found in your group' },
        { status: 404 }
      )
    }

    // Delete the trip (cascade deletes will handle trip_days, events, expenses)
    await prisma.trip.delete({
      where: { id: tripId }
    })

    // Revalidate all related caches after deletion
    CacheManager.revalidateTrip(tripId, groupId);
    CacheManager.revalidateEvents(tripId, groupId);
    CacheManager.revalidateExpenses(tripId, groupId);

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting trip:', error)
    return NextResponse.json(
      { error: 'Failed to delete trip' },
      { status: 500 }
    )
  }
}