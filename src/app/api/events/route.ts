import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { withSessionContext, requirePermission } from '@/lib/supabase/session'

type EventInsert = Database['public']['Tables']['events']['Insert']
type ExpenseInsert = Database['public']['Tables']['expenses']['Insert']

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dayId = searchParams.get('dayId')
  const tripId = searchParams.get('tripId')

  try {
    return await withSessionContext(async (context, supabase) => {
      let query = supabase
        .from('events')
        .select(`
          *,
          trip_days!inner(
            id,
            trip_id,
            trips!inner(
              group_id
            )
          ),
          expenses(*)
        `)
        // Always filter by group to ensure isolation
        .eq('trip_days.trips.group_id', context.groupId)

      if (dayId) {
        query = query.eq('day_id', dayId)
      } else if (tripId) {
        query = query.eq('trip_days.trip_id', tripId)
      }

      const { data: events, error } = await query.order('start_time')

      if (error) {
        console.error('Error fetching events:', error)
        return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
      }

      return NextResponse.json({ events })
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
    const { event, expenses }: { 
      event: EventInsert
      expenses?: Omit<ExpenseInsert, 'day_id' | 'event_id'>[] 
    } = body

    return await withSessionContext(async (context, supabase) => {
      // Check create permission
      requirePermission(context, 'create')

      console.log('Creating event with data:', {
        event,
        expenses,
        traveler: context.travelerName
      })

      // Verify trip day exists and belongs to user's group
      const { data: tripDay, error: tripDayError } = await supabase
        .from('trip_days')
        .select(`
          id,
          trips!inner(
            group_id
          )
        `)
        .eq('id', event.day_id)
        .eq('trips.group_id', context.groupId)
        .single()

      if (tripDayError || !tripDay) {
        console.error('Trip day verification failed:', {
          dayId: event.day_id,
          error: tripDayError,
          tripDay
        })
        return NextResponse.json({ 
          error: 'Trip day not found or access denied',
          details: tripDayError?.message || 'Trip day does not exist or you do not have access'
        }, { status: 404 })
      }

      // Create the event
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert(event)
        .select()
        .single()

      if (eventError) {
        console.error('Error creating event:', {
          error: eventError,
          errorMessage: eventError.message,
          errorDetails: eventError.details,
          eventData: event
        })
        return NextResponse.json({ 
          error: eventError.message || 'Failed to create event',
          details: eventError.details || eventError.hint || 'Database error occurred'
        }, { status: 500 })
      }

      // Create associated expenses if provided
      if (expenses && expenses.length > 0) {
        const expenseInserts: ExpenseInsert[] = expenses.map(expense => ({
          ...expense,
          day_id: event.day_id,
          event_id: newEvent.id
        }))

        const { error: expenseError } = await supabase
          .from('expenses')
          .insert(expenseInserts)

        if (expenseError) {
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