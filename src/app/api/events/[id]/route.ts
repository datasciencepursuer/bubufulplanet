import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Event, Expense } from '@prisma/client'
import { formatTimeForStorage, normalizeDate, validateDateRange, extractTimeString } from '@/lib/dateTimeUtils'

type EventUpdate = Partial<Omit<Event, 'id' | 'createdAt'>>
type ExpenseInsert = Omit<Expense, 'id' | 'createdAt' | 'dayId' | 'eventId'>

// API input interface with snake_case naming
interface EventUpdateInput {
  title?: string
  start_time?: string
  end_time?: string | null
  start_date?: string
  end_date?: string | null
  location?: string | null
  notes?: string | null
  weather?: string | null
  loadout?: string | null
  color?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        day: {
          select: {
            id: true,
            tripId: true
          }
        },
        expenses: true
      }
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Transform Prisma camelCase to snake_case for API compatibility
    const transformedEvent = {
      id: event.id,
      day_id: event.dayId,
      title: event.title,
      start_time: extractTimeString(event.startTime), // Use consistent time extraction
      end_time: event.endTime ? extractTimeString(event.endTime) : null,
      start_date: normalizeDate(event.startDate), // Use consistent date normalization
      end_date: event.endDate ? normalizeDate(event.endDate) : null,
      location: event.location,
      notes: event.notes,
      weather: event.weather,
      loadout: event.loadout,
      color: event.color,
      created_at: event.createdAt.toISOString(),
      trip_days: event.day ? {
        id: event.day.id,
        trip_id: event.day.tripId
      } : null,
      expenses: event.expenses?.map(expense => ({
        id: expense.id,
        event_id: expense.eventId,
        day_id: expense.dayId,
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        created_at: expense.createdAt.toISOString()
      })) || []
    }

    return NextResponse.json({ event: transformedEvent })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { event, expenses }: { 
      event: EventUpdateInput
      expenses?: Omit<ExpenseInsert, 'day_id' | 'event_id'>[] 
    } = body

    // Verify event exists and get day_id
    const existingEvent = await prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        dayId: true
      }
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Transform snake_case input to camelCase for Prisma with validation
    const prismaEventData: any = {}
    
    if (event.title !== undefined) prismaEventData.title = event.title
    
    if (event.start_time !== undefined) {
      prismaEventData.startTime = formatTimeForStorage(event.start_time)
    }
    
    if (event.end_time !== undefined) {
      prismaEventData.endTime = event.end_time ? formatTimeForStorage(event.end_time) : null
    }
    
    if (event.start_date !== undefined) {
      const normalizedStartDate = normalizeDate(event.start_date)
      prismaEventData.startDate = new Date(normalizedStartDate)
    }
    
    if (event.end_date !== undefined) {
      const normalizedEndDate = event.end_date ? normalizeDate(event.end_date) : null
      prismaEventData.endDate = normalizedEndDate ? new Date(normalizedEndDate) : null
      
      // Validate date range if both dates are being updated
      if (event.start_date !== undefined && normalizedEndDate) {
        const normalizedStartDate = normalizeDate(event.start_date)
        if (!validateDateRange(normalizedStartDate, normalizedEndDate)) {
          return NextResponse.json({ 
            error: 'Invalid date range',
            details: 'End date cannot be before start date'
          }, { status: 400 })
        }
      }
    }
    
    if (event.location !== undefined) prismaEventData.location = event.location
    if (event.notes !== undefined) prismaEventData.notes = event.notes
    if (event.weather !== undefined) prismaEventData.weather = event.weather
    if (event.loadout !== undefined) prismaEventData.loadout = event.loadout
    if (event.color !== undefined) prismaEventData.color = event.color

    // Update the event
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: prismaEventData
    })

    // Handle expenses update if provided
    if (expenses !== undefined) {
      // Delete existing expenses for this event
      await prisma.expense.deleteMany({
        where: { eventId: id }
      })

      // Insert new expenses if any
      if (expenses.length > 0) {
        const expenseInserts = expenses.map(expense => ({
          ...expense,
          dayId: existingEvent.dayId,
          eventId: id
        }))

        await prisma.expense.createMany({
          data: expenseInserts
        })
      }
    }

    // Transform Prisma camelCase to snake_case for API compatibility
    const transformedEvent = {
      id: updatedEvent.id,
      day_id: updatedEvent.dayId,
      title: updatedEvent.title,
      start_time: extractTimeString(updatedEvent.startTime), // Use consistent time extraction
      end_time: updatedEvent.endTime ? extractTimeString(updatedEvent.endTime) : null,
      start_date: normalizeDate(updatedEvent.startDate), // Use consistent date normalization
      end_date: updatedEvent.endDate ? normalizeDate(updatedEvent.endDate) : null,
      location: updatedEvent.location,
      notes: updatedEvent.notes,
      weather: updatedEvent.weather,
      loadout: updatedEvent.loadout,
      color: updatedEvent.color,
      created_at: updatedEvent.createdAt.toISOString()
    }

    return NextResponse.json({ event: transformedEvent })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true }
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Delete the event (expenses will be deleted automatically due to CASCADE)
    await prisma.event.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}