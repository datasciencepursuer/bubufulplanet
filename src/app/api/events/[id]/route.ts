import { NextRequest, NextResponse } from 'next/server'
import { withUnifiedSessionContext, requireUnifiedPermission } from '@/lib/unified-session'
import { prisma } from '@/lib/prisma'
import { isValidTimeSlot, getNextTimeSlot } from '@/lib/timeSlotUtils'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    return await withUnifiedSessionContext(async (context) => {
      const event = await prisma.event.findFirst({
        where: {
          id: params.id,
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

      return NextResponse.json({ event })
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

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { event, expenses } = body

    return await withUnifiedSessionContext(async (context) => {
      // Check modify permission
      requireUnifiedPermission(context, 'modify')

      // Verify event exists and belongs to user's group
      const existingEvent = await prisma.event.findFirst({
        where: {
          id: params.id,
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
        where: { id: params.id },
        data: eventData
      })

      // Update expenses
      if (expenses !== undefined) {
        // Delete existing expenses
        await prisma.expense.deleteMany({
          where: { eventId: params.id }
        })

        // Create new expenses if provided
        if (expenses.length > 0) {
          await prisma.expense.createMany({
            data: expenses.map((expense: any) => ({
              eventId: params.id,
              dayId: existingEvent.dayId,
              description: expense.description,
              amount: expense.amount,
              category: expense.category
            }))
          })
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

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    return await withUnifiedSessionContext(async (context) => {
      // Check modify permission
      requireUnifiedPermission(context, 'modify')

      // Verify event exists and belongs to user's group
      const existingEvent = await prisma.event.findFirst({
        where: {
          id: params.id,
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

      // Delete the event (expenses will be deleted automatically due to CASCADE)
      await prisma.event.delete({
        where: { id: params.id }
      })

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