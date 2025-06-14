import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type EventUpdate = Database['public']['Tables']['events']['Update']
type ExpenseInsert = Database['public']['Tables']['expenses']['Insert']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  try {
    const { data: event, error } = await supabase
      .from('events')
      .select(`
        *,
        trip_days!inner(
          id,
          trip_id
        ),
        expenses(*)
      `)
      .eq('id', id)
      .single()

    if (error || !event) {
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
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { event, expenses }: { 
      event: EventUpdate
      expenses?: Omit<ExpenseInsert, 'day_id' | 'event_id'>[] 
    } = body

    // Verify event exists
    const { data: existingEvent, error: verifyError } = await supabase
      .from('events')
      .select(`
        id,
        day_id
      `)
      .eq('id', id)
      .single()

    if (verifyError || !existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Update the event
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update(event)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating event:', updateError)
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
    }

    // Handle expenses update if provided
    if (expenses !== undefined) {
      // Delete existing expenses for this event
      await supabase
        .from('expenses')
        .delete()
        .eq('event_id', id)

      // Insert new expenses if any
      if (expenses.length > 0) {
        const expenseInserts: ExpenseInsert[] = expenses.map(expense => ({
          ...expense,
          day_id: existingEvent.day_id,
          event_id: id
        }))

        const { error: expenseError } = await supabase
          .from('expenses')
          .insert(expenseInserts)

        if (expenseError) {
          console.error('Error updating expenses:', expenseError)
          // Event was updated successfully, but expenses failed
        }
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
  const supabase = await createClient()

  try {
    // Verify event exists
    const { data: event, error: verifyError } = await supabase
      .from('events')
      .select('id')
      .eq('id', id)
      .single()

    if (verifyError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Delete the event (expenses will be deleted automatically due to CASCADE)
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting event:', deleteError)
      return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}