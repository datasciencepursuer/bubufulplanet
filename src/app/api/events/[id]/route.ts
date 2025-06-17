import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Event, Expense } from '@prisma/client'

type EventUpdate = Partial<Omit<Event, 'id' | 'createdAt'>>
type ExpenseInsert = Omit<Expense, 'id' | 'createdAt' | 'dayId' | 'eventId'>

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        tripDay: {
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

    return NextResponse.json({ event })
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
      event: EventUpdate
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

    // Update the event
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: event
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

    return NextResponse.json({ event: updatedEvent })
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