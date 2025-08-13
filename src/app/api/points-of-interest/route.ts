import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

// GET all points of interest for the current group
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tripId = searchParams.get('tripId')

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

    const whereClause = {
      groupId: userGroup.groupId,
      ...(tripId && { tripId })
    }

    const pointsOfInterest = await prisma.pointOfInterest.findMany({
      where: whereClause,
      include: {
        trip: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ pointsOfInterest })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in GET /api/points-of-interest:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create a new point of interest
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { destinationName, address, notes, link, tripId } = body

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

      // Validate required fields
      if (!destinationName?.trim()) {
        return NextResponse.json({ error: 'Destination name is required' }, { status: 400 })
      }

      // If tripId is provided, verify it belongs to the same group
      if (tripId) {
        const trip = await prisma.trip.findFirst({
          where: {
            id: tripId,
            groupId: userGroup.groupId
          }
        })
    
        if (!trip) {
          return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 })
        }
      }

      const pointOfInterest = await prisma.pointOfInterest.create({
        data: {
          destinationName: destinationName.trim(),
          address: address?.trim() || null,
          notes: notes?.trim() || null,
          link: link?.trim() || null,
          groupId: userGroup.groupId,
          tripId: tripId || null
        },
        include: {
          trip: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
  
      return NextResponse.json({ pointOfInterest })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in POST /api/points-of-interest:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT update a point of interest
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, destinationName, address, notes, link, tripId } = body

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

      if (!id) {
        return NextResponse.json({ error: 'Point of interest ID is required' }, { status: 400 })
      }

      // Verify the point of interest belongs to this group
      const existing = await prisma.pointOfInterest.findFirst({
        where: {
          id,
          groupId: userGroup.groupId
        }
      })
  
      if (!existing) {
        return NextResponse.json({ error: 'Point of interest not found' }, { status: 404 })
      }

      // If tripId is provided, verify it belongs to the same group
      if (tripId) {
        const trip = await prisma.trip.findFirst({
          where: {
            id: tripId,
            groupId: userGroup.groupId
          }
        })
    
        if (!trip) {
          return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 })
        }
      }

      const pointOfInterest = await prisma.pointOfInterest.update({
        where: { id },
        data: {
          destinationName: destinationName?.trim() || existing.destinationName,
          address: address?.trim() || null,
          notes: notes?.trim() || null,
          link: link?.trim() || null,
          tripId: tripId === '' ? null : (tripId || existing.tripId)
        },
        include: {
          trip: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
  
      return NextResponse.json({ pointOfInterest })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in PUT /api/points-of-interest:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE a point of interest
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

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

      if (!id) {
        return NextResponse.json({ error: 'Point of interest ID is required' }, { status: 400 })
      }

      // Verify the point of interest belongs to this group
      const existing = await prisma.pointOfInterest.findFirst({
        where: {
          id,
          groupId: userGroup.groupId
        }
      })
  
      if (!existing) {
        return NextResponse.json({ error: 'Point of interest not found' }, { status: 404 })
      }

      await prisma.pointOfInterest.delete({
        where: { id }
      })
  
      return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in DELETE /api/points-of-interest:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}