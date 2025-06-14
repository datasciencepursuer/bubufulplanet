import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const supabase = createServiceClient()
    
    // Check if trips table exists by trying to select from it
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('count(*)')
      .limit(1)

    // Check if trip_days table exists
    const { data: tripDays, error: tripDaysError } = await supabase
      .from('trip_days')
      .select('count(*)')
      .limit(1)

    // Check if events table exists
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('count(*)')
      .limit(1)

    // Check if expenses table exists
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('count(*)')
      .limit(1)

    // Check if packing_items table exists
    const { data: packingItems, error: packingItemsError } = await supabase
      .from('packing_items')
      .select('count(*)')
      .limit(1)

    const tableStatus = {
      trips: tripsError ? { exists: false, error: tripsError.message } : { exists: true, data: trips },
      trip_days: tripDaysError ? { exists: false, error: tripDaysError.message } : { exists: true, data: tripDays },
      events: eventsError ? { exists: false, error: eventsError.message } : { exists: true, data: events },
      expenses: expensesError ? { exists: false, error: expensesError.message } : { exists: true, data: expenses },
      packing_items: packingItemsError ? { exists: false, error: packingItemsError.message } : { exists: true, data: packingItems }
    }

    const allTablesExist = Object.values(tableStatus).every(status => status.exists)

    return NextResponse.json({
      databaseSetup: allTablesExist,
      tables: tableStatus,
      message: allTablesExist 
        ? 'All database tables exist and are accessible'
        : 'Some database tables are missing or inaccessible. Please run the database setup.'
    })

  } catch (error) {
    console.error('Database check error:', error)
    return NextResponse.json({
      error: 'Failed to check database status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}