import { NextRequest, NextResponse } from 'next/server'
import { withUnifiedSessionContext, requireUnifiedPermission } from '@/lib/unified-session'
import { prisma } from '@/lib/prisma'
import { isValidTimeSlot, getNextTimeSlot } from '@/lib/timeSlotUtils'
import { CACHE_TAGS, CACHE_DURATIONS, CacheManager } from '@/lib/cache'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    return await withUnifiedSessionContext(async (context) => {
      const event = await prisma.event.findFirst({
        where: {
          id: id,
          day: {
            trip: {
              groupId: context.groupId
            }
          }
        },
        include: {
          day: true,
          expenses: true
        }
      })

      if (!event) {
        return NextResponse.json({ 
          error: 'Event not found',
          details: 'Event does not exist or you do not have access'
        }, { status: 404 })
      }

      const response = NextResponse.json({ event })
      
      // Add cache headers for individual event
      const cacheHeaders = CacheManager.getCacheHeaders(
        CACHE_DURATIONS.EVENTS,
        [CACHE_TAGS.DAY_EVENTS(event.dayId)]
      );
      
      Object.entries(cacheHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      response.headers.set('ETag', CacheManager.generateETag(`event-${id}`));
      
      return response
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Unexpected error in GET /api/events/[id]:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { event, expenses } = body

    return await withUnifiedSessionContext(async (context) => {
      // Check modify permission
      requireUnifiedPermission(context, 'modify')

      // Verify event exists and belongs to user's group
      const existingEvent = await prisma.event.findFirst({
        where: {
          id: id,
          day: {
            trip: {
              groupId: context.groupId
            }
          }
        }
      })

      if (!existingEvent) {
        return NextResponse.json({ 
          error: 'Event not found',
          details: 'Event does not exist or you do not have access'
        }, { status: 404 })
      }

      // Validate required fields
      if (!event.title || !event.startSlot) {
        return NextResponse.json({ 
          error: 'Missing required fields',
          details: 'title and startSlot are required'
        }, { status: 400 })
      }

      // Validate time slots
      if (!isValidTimeSlot(event.startSlot)) {
        return NextResponse.json({ 
          error: 'Invalid start time slot',
          details: 'startSlot must be a valid time slot (e.g., "09:00")'
        }, { status: 400 })
      }

      if (event.endSlot && !isValidTimeSlot(event.endSlot)) {
        return NextResponse.json({ 
          error: 'Invalid end time slot',
          details: 'endSlot must be a valid time slot (e.g., "10:00")'
        }, { status: 400 })
      }

      const eventData = {
        title: event.title,
        startSlot: event.startSlot,
        endSlot: event.endSlot || getNextTimeSlot(event.startSlot),
        location: event.location || null,
        notes: event.notes || null,
        weather: event.weather || null,
        loadout: event.loadout || null,
        color: event.color || '#3B82F6'
      }

      // Update the event
      const updatedEvent = await prisma.event.update({
        where: { id: id },
        data: eventData
      })

      // Update expenses
      if (expenses !== undefined) {
        // Delete existing expenses
        await prisma.expense.deleteMany({
          where: { eventId: id }
        })

        // Create new expenses if provided
        if (expenses.length > 0) {
          await prisma.expense.createMany({
            data: expenses.map((expense: any) => ({
              eventId: id,
              dayId: existingEvent.dayId,
              description: expense.description,
              amount: expense.amount,
              category: expense.category
            }))
          })
        }
      }

      // Get trip info for cache revalidation
      const tripDay = await prisma.tripDay.findFirst({
        where: { id: existingEvent.dayId },
        include: { trip: { select: { id: true, groupId: true } } }
      });

      if (tripDay?.trip?.groupId) {
        // Revalidate event caches after update
        CacheManager.revalidateEvents(tripDay.trip.id, tripDay.trip.groupId, existingEvent.dayId);
        
        // Also revalidate expenses if they were updated
        if (expenses !== undefined) {
          CacheManager.revalidateExpenses(tripDay.trip.id, tripDay.trip.groupId);
        }
      }

      return NextResponse.json({ event: updatedEvent })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Unexpected error in PUT /api/events/[id]:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    return await withUnifiedSessionContext(async (context) => {
      // Check modify permission
      requireUnifiedPermission(context, 'modify')

      // Verify event exists and belongs to user's group - get trip info for cache revalidation
      const existingEvent = await prisma.event.findFirst({
        where: {
          id: id,
          day: {
            trip: {
              groupId: context.groupId
            }
          }
        },
        include: {
          day: {
            include: {
              trip: {
                select: { id: true, groupId: true }
              }
            }
          }
        }
      })

      if (!existingEvent) {
        return NextResponse.json({ 
          error: 'Event not found',
          details: 'Event does not exist or you do not have access'
        }, { status: 404 })
      }

      // Delete the event (expenses will be deleted automatically due to CASCADE)
      await prisma.event.delete({
        where: { id: id }
      })

      // Revalidate event caches after deletion
      if (existingEvent.day.trip?.groupId) {
        CacheManager.revalidateEvents(existingEvent.day.trip.id, existingEvent.day.trip.groupId, existingEvent.dayId);
        // Also revalidate expenses since event expenses were deleted
        CacheManager.revalidateExpenses(existingEvent.day.trip.id, existingEvent.day.trip.groupId);
      }

      return NextResponse.json({ message: 'Event deleted successfully' })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Unexpected error in DELETE /api/events/[id]:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}