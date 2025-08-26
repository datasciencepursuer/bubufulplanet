import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'

// Update user's last accessed trip in the database
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tripId }: { tripId: string } = await request.json()

    if (!tripId) {
      return NextResponse.json({ error: 'Trip ID is required' }, { status: 400 })
    }

    // Verify the trip exists and user has access to it
    const trip = await prisma.trip.findFirst({
      where: { 
        id: tripId,
        // User must be a member of the group that owns this trip
        group: {
          userGroups: {
            some: { userId: user.id }
          }
        }
      },
      include: { group: true }
    })

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found or access denied' }, { status: 404 })
    }

    // Update the UserGroup record to set lastActiveTripId
    const updated = await prisma.userGroup.updateMany({
      where: {
        userId: user.id,
        groupId: trip.groupId!
      },
      data: {
        lastActiveTripId: tripId,
        lastActiveAt: new Date() // Also update group activity
      }
    })

    if (updated.count === 0) {
      return NextResponse.json({ error: 'User group relationship not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      tripId,
      groupId: trip.groupId 
    })

  } catch (error) {
    console.error('Error updating last accessed trip:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get user's last accessed trip info
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's most recently active group with last active trip
    const userGroup = await prisma.userGroup.findFirst({
      where: { userId: user.id },
      include: { 
        group: {
          select: {
            id: true,
            name: true
          }
        },
        lastActiveTrip: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            destination: true
          }
        }
      },
      orderBy: { lastActiveAt: 'desc' }
    })

    if (!userGroup || !userGroup.lastActiveTripId) {
      return NextResponse.json({ 
        lastActiveTrip: null,
        message: 'No last active trip found' 
      })
    }

    return NextResponse.json({
      lastActiveTrip: {
        tripId: userGroup.lastActiveTripId,
        groupId: userGroup.groupId,
        trip: userGroup.lastActiveTrip,
        group: userGroup.group
      }
    })

  } catch (error) {
    console.error('Error getting last accessed trip:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}