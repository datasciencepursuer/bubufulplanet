import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

interface DestinationRange {
  destination: string
  startDate: string
  endDate: string
  dayIds: string[]
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's current group
    const userGroup = await prisma.userGroup.findFirst({
      where: { userId: user.id },
      include: { group: true }
    })

    if (!userGroup) {
      return NextResponse.json({ error: 'No group found' }, { status: 404 })
    }

    // Verify trip belongs to user's group
    const trip = await prisma.trip.findFirst({
      where: {
        id,
        groupId: userGroup.groupId
      }
    })

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    const body = await request.json()
    const { ranges }: { ranges: DestinationRange[] } = body

    if (!Array.isArray(ranges)) {
      return NextResponse.json({ error: 'Invalid ranges data' }, { status: 400 })
    }

    // First, clear all existing destinations for this trip
    await prisma.tripDay.updateMany({
      where: {
        tripId: id
      },
      data: {
        destination: null
      }
    })

    // Then update destinations for specified ranges
    for (const range of ranges) {
      if (range.destination.trim() && range.dayIds.length > 0) {
        await prisma.tripDay.updateMany({
          where: {
            id: { in: range.dayIds },
            tripId: id
          },
          data: {
            destination: range.destination.trim()
          }
        })
      }
    }

    // Return updated trip days
    const updatedTripDays = await prisma.tripDay.findMany({
      where: {
        tripId: id
      },
      orderBy: {
        dayNumber: 'asc'
      }
    })

    return NextResponse.json(updatedTripDays)
  } catch (error) {
    console.error('Error updating trip destinations:', error)
    return NextResponse.json(
      { error: 'Failed to update destinations' }, 
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's current group
    const userGroup = await prisma.userGroup.findFirst({
      where: { userId: user.id },
      include: { group: true }
    })

    if (!userGroup) {
      return NextResponse.json({ error: 'No group found' }, { status: 404 })
    }

    // Verify trip belongs to user's group
    const trip = await prisma.trip.findFirst({
      where: {
        id,
        groupId: userGroup.groupId
      }
    })

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    // Get trip days with destinations
    const tripDays = await prisma.tripDay.findMany({
      where: {
        tripId: id
      },
      orderBy: {
        dayNumber: 'asc'
      }
    })

    return NextResponse.json(tripDays)
  } catch (error) {
    console.error('Error fetching trip destinations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch destinations' }, 
      { status: 500 }
    )
  }
}