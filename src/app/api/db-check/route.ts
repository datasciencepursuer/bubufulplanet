import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const tableStatus: Record<string, { exists: boolean; error?: string; count?: number }> = {}
    
    // Check each table using Prisma
    try {
      const tripsCount = await prisma.trip.count()
      tableStatus.trips = { exists: true, count: tripsCount }
    } catch (error) {
      tableStatus.trips = { exists: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }

    try {
      const tripDaysCount = await prisma.tripDay.count()
      tableStatus.trip_days = { exists: true, count: tripDaysCount }
    } catch (error) {
      tableStatus.trip_days = { exists: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }

    try {
      const eventsCount = await prisma.event.count()
      tableStatus.events = { exists: true, count: eventsCount }
    } catch (error) {
      tableStatus.events = { exists: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }

    try {
      const expensesCount = await prisma.expense.count()
      tableStatus.expenses = { exists: true, count: expensesCount }
    } catch (error) {
      tableStatus.expenses = { exists: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }

    try {
      const packingItemsCount = await prisma.packingItem.count()
      tableStatus.packing_items = { exists: true, count: packingItemsCount }
    } catch (error) {
      tableStatus.packing_items = { exists: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }

    // Check group tables too
    try {
      const groupsCount = await prisma.travelGroup.count()
      tableStatus.travel_groups = { exists: true, count: groupsCount }
    } catch (error) {
      tableStatus.travel_groups = { exists: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }

    try {
      const membersCount = await prisma.groupMember.count()
      tableStatus.group_members = { exists: true, count: membersCount }
    } catch (error) {
      tableStatus.group_members = { exists: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }

    const allTablesExist = Object.values(tableStatus).every(status => status.exists)

    return NextResponse.json({
      databaseSetup: allTablesExist,
      tables: tableStatus,
      message: allTablesExist 
        ? 'All database tables exist and are accessible via Prisma'
        : 'Some database tables are missing or inaccessible. Please run the database setup.',
      orm: 'Prisma'
    })

  } catch (error) {
    console.error('Database check error:', error)
    return NextResponse.json({
      error: 'Failed to check database status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}