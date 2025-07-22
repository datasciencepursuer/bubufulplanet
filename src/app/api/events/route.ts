import { NextRequest, NextResponse } from 'next/server'
import { withUnifiedSessionContext, requireUnifiedPermission } from '@/lib/unified-session'
import { prisma } from '@/lib/prisma'
import { isValidTimeSlot, getNextTimeSlot } from '@/lib/timeSlotUtils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dayId = searchParams.get('dayId')
  const tripId = searchParams.get('tripId')

  try {
    return await withUnifiedSessionContext(async (context) => {
      let whereClause: any = {}
      
      if (dayId) {
        whereClause.dayId = dayId
      } else if (tripId) {
        whereClause.day = {
          trip: {
            id: tripId,
            groupId: context.groupId
          }
        }
      } else {
        // Default to all events for the user's group
        whereClause.day = {
          trip: {
            groupId: context.groupId
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
      
      // Add cache headers for events data
      response.headers.set('Cache-Control', 'private, max-age=180, stale-while-revalidate=300'); // 3 min cache, 5 min stale
      response.headers.set('ETag', `events-${context.groupId}-${tripId || dayId || 'all'}-${Date.now()}`);
      
      return response;
    })
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

    return await withUnifiedSessionContext(async (context) => {
      // Check create permission
      requireUnifiedPermission(context, 'create')

      console.log('Creating event with simplified data:', {
        event,
        expenses,
        traveler: context.travelerName
      })

      // Verify trip day exists and belongs to user's group
      const dayId = event.dayId
      const tripDay = await prisma.tripDay.findFirst({
        where: {
          id: dayId,
          trip: {
            groupId: context.groupId
          }
        }
      })

      if (!tripDay) {
        console.error('Trip day verification failed:', {
          dayId: dayId,
          groupId: context.groupId
        })
        return NextResponse.json({ 
          error: 'Trip day not found or access denied',
          details: 'Trip day does not exist or you do not have access'
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

      // Create the event
      const newEvent = await prisma.event.create({
        data: eventData
      })

      // Create associated expenses if provided
      if (expenses && expenses.length > 0) {
        try {
          await prisma.expense.createMany({
            data: expenses.map((expense: any) => ({
              eventId: newEvent.id,
              dayId: dayId,
              description: expense.description,
              amount: expense.amount,
              category: expense.category
            }))
          })
        } catch (expenseError) {
          console.error('Error creating expenses:', expenseError)
          // Event was created successfully, but expenses failed
          // Return success but log the error
        }
      }

      return NextResponse.json({ event: newEvent }, { status: 201 })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Unexpected error in POST /api/events:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      details: 'An unexpected error occurred while creating the event'
    }, { status: 500 })
  }
}