import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { isValidTimeSlot, getNextTimeSlot } from '@/lib/timeSlotUtils'
import { CACHE_TAGS, CACHE_DURATIONS, CacheManager } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dayId = searchParams.get('dayId')
  const tripId = searchParams.get('tripId')

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get groupId from header or query params, fallback to user's first group
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

    let whereClause: any = {}
    
    if (dayId) {
      whereClause.dayId = dayId
    } else if (tripId) {
      whereClause.day = {
        trip: {
          id: tripId,
          groupId: groupId
        }
      }
    } else {
      // Default to all events for the user's group
      whereClause.day = {
        trip: {
          groupId: groupId
        }
      }
    }

      const events = await prisma.event.findMany({
        where: whereClause,
        include: {
          day: {
            select: {
              id: true,
              tripId: true,
              date: true
            }
          },
          expenses: true
        },
        orderBy: {
          startSlot: 'asc'
        }
      })

    const response = NextResponse.json({ events });
    
    // Determine cache tags based on query parameters
    const cacheTags = [CACHE_TAGS.EVENTS(groupId)];
    if (tripId) {
      cacheTags.push(CACHE_TAGS.TRIP_EVENTS(tripId));
    }
    if (dayId) {
      cacheTags.push(CACHE_TAGS.DAY_EVENTS(dayId));
    }
    
    // Add cache headers with tags for revalidation
    const cacheHeaders = CacheManager.getCacheHeaders(
      CACHE_DURATIONS.EVENTS,
      cacheTags
    );
    
    Object.entries(cacheHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    response.headers.set('ETag', CacheManager.generateETag(`events-${groupId}-${tripId || dayId || 'all'}`));
    
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Unexpected error in GET /api/events:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      details: 'An unexpected error occurred while fetching events'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, expenses } = body

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

    console.log('Creating event with simplified data:', {
      event,
      expenses,
      user: user.email
    })

    // Verify trip day exists and belongs to user's group (optimization: combine with event creation)
    const dayId = event.dayId

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
        dayId: dayId,
        title: event.title,
        startSlot: event.startSlot,
        endSlot: event.endSlot || getNextTimeSlot(event.startSlot),
        location: event.location || null,
        notes: event.notes || null,
        weather: event.weather || null,
        loadout: event.loadout || null,
        color: event.color || '#3B82F6'
      }

    // Create event with verification and expenses in transaction to reduce database calls
    const newEvent = await prisma.$transaction(async (tx) => {
        // Verify trip day exists and belongs to user's group within transaction
        const tripDay = await tx.tripDay.findFirst({
          where: {
            id: dayId,
            trip: {
              groupId: groupId
            }
          }
        })

        if (!tripDay) {
          throw new Error('Trip day not found or access denied')
        }

        // Create the event
        const event = await tx.event.create({
          data: eventData
        })

        // Create associated expenses if provided
        if (expenses && expenses.length > 0) {
          await tx.expense.createMany({
            data: expenses.map((expense: any) => ({
              eventId: event.id,
              dayId: dayId,
              tripId: tripDay.tripId,
              description: expense.description,
              amount: expense.amount,
              category: expense.category,
              ownerId: expense.ownerId,
              groupId: groupId
            }))
          })
        }

        return event
      })

    // Get trip info for cache revalidation
    const tripDay = await prisma.tripDay.findFirst({
      where: { id: dayId },
      include: { trip: { select: { id: true, groupId: true } } }
    });

    if (tripDay?.trip?.groupId) {
      // Revalidate event caches after creation
      CacheManager.revalidateEvents(tripDay.trip.id, tripDay.trip.groupId, dayId);
    }

    return NextResponse.json({ event: newEvent }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Trip day not found or access denied') {
      return NextResponse.json({ 
        error: 'Trip day not found or access denied',
        details: 'Trip day does not exist or you do not have access'
      }, { status: 404 })
    }
    console.error('Unexpected error in POST /api/events:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      details: 'An unexpected error occurred while creating the event'
    }, { status: 500 })
  }
}