import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'

// Optimized group switching endpoint - gets ALL data in minimal DB calls
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupId }: { groupId: string } = await request.json()

    if (!groupId) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
    }

    console.log('Group switch optimization: Starting optimized switch to', groupId)
    const startTime = Date.now()

    // SINGLE OPTIMIZED QUERY - Get everything we need in one shot
    // Check UserGroup by both userId (if linked) and email (for invitations)
    const result = await prisma.userGroup.findFirst({
      where: { 
        groupId: groupId,
        OR: [
          { userId: user.id },
          { email: user.email }
        ]
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            accessCode: true,
            createdAt: true,
            // Get trips with minimal data
            // Get group members
            groupMembers: {
              select: {
                id: true,
                travelerName: true,
                role: true,
                permissions: true,
                userId: true,
                joinedAt: true
              },
              orderBy: { joinedAt: 'asc' }
            },
            // Get points of interest
            pointsOfInterest: {
              select: {
                id: true,
                destinationName: true,
                address: true,
                notes: true,
                link: true,
                tripId: true,
                createdAt: true
              },
              orderBy: { createdAt: 'desc' },
              take: 100
            },
            // Get expenses through trips relation
            trips: {
              select: {
                id: true,
                name: true,
                destination: true,
                startDate: true,
                endDate: true,
                createdAt: true,
                expenses: {
                  select: {
                    id: true,
                    amount: true,
                    description: true,
                    ownerId: true,
                    tripId: true,
                    participants: {
                      select: {
                        participantId: true,
                        amountOwed: true
                      }
                    }
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 50 // Limit expenses per trip
                }
              },
              orderBy: { createdAt: 'desc' },
              take: 50 // Limit to prevent huge responses
            }
          }
        }
      }
    })

    if (!result || !result.group) {
      return NextResponse.json({ error: 'User is not a member of this group' }, { status: 403 })
    }

    // Find current user's member record
    const currentMember = result.group.groupMembers.find(member => member.userId === user.id)
    
    if (!currentMember) {
      return NextResponse.json({ error: 'Member record not found' }, { status: 404 })
    }

    // Calculate expense summary efficiently (simplified version)
    // Flatten expenses from all trips with proper null checks
    const expenses = (result.group.trips || []).flatMap(trip => trip.expenses || [])
    const currentMemberId = currentMember.id
    
    let totalYouOwe = 0
    let totalOwedToYou = 0
    
    // Quick expense calculation - more detailed version can be loaded later if needed
    for (const expense of expenses) {
      try {
        if (expense.ownerId === currentMemberId) {
          // Money others owe to current member
          for (const participant of expense.participants || []) {
            if (participant.participantId && participant.participantId !== currentMemberId) {
              totalOwedToYou += Number(participant.amountOwed || 0)
            }
          }
        } else {
          // Money current member owes to others
          const myParticipation = (expense.participants || []).find(p => p.participantId === currentMemberId)
          if (myParticipation) {
            totalYouOwe += Number(myParticipation.amountOwed || 0)
          }
        }
      } catch (error) {
        console.warn('Error calculating expense for expense ID:', expense.id, error)
        // Continue processing other expenses
      }
    }

    // Build comprehensive response with proper null checks
    const optimizedResponse = {
      // Group information
      group: {
        id: result.group.id,
        name: result.group.name,
        accessCode: result.group.accessCode,
        createdAt: result.group.createdAt.toISOString()
      },
      
      // Current user's member information
      currentMember: {
        id: currentMember.id,
        name: currentMember.travelerName,
        role: currentMember.role,
        permissions: currentMember.permissions,
        joinedAt: currentMember.joinedAt.toISOString()
      },

      // All group members (ensure array is never undefined)
      allMembers: (result.group.groupMembers || []).map(member => ({
        id: member.id,
        traveler_name: member.travelerName,
        role: member.role,
        permissions: member.permissions,
        joined_at: member.joinedAt.toISOString()
      })),

      // Trips data (ensure array is never undefined)
      trips: (result.group.trips || []).map(trip => ({
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        startDate: trip.startDate.toISOString().split('T')[0], // YYYY-MM-DD format
        endDate: trip.endDate.toISOString().split('T')[0],
        createdAt: trip.createdAt.toISOString()
      })),

      // Points of interest (ensure array is never undefined)
      pointsOfInterest: (result.group.pointsOfInterest || []).map(poi => ({
        id: poi.id,
        destinationName: poi.destinationName,
        address: poi.address,
        notes: poi.notes,
        link: poi.link,
        tripId: poi.tripId,
        trip: poi.tripId ? (result.group.trips || []).find(t => t.id === poi.tripId) : null
      })),

      // Simplified expense summary
      expensesSummary: {
        currentMemberId: currentMember.id,
        currentMemberName: currentMember.travelerName,
        totalYouOwe,
        totalOwedToYou,
        netBalance: totalOwedToYou - totalYouOwe,
        totalExpenses: expenses.length,
        hasDetailedData: expenses.length <= 250 // Flag if we have complete data (50 expenses * 5 trips average)
      },

      // Performance metadata
      performance: {
        queryTimeMs: Date.now() - startTime,
        dataPoints: {
          trips: (result.group.trips || []).length,
          members: (result.group.groupMembers || []).length,
          pointsOfInterest: (result.group.pointsOfInterest || []).length,
          expenses: expenses.length
        }
      }
    }

    console.log(`Group switch optimization: Completed in ${Date.now() - startTime}ms`)
    
    // Add cache headers for this consolidated response
    const response = NextResponse.json(optimizedResponse)
    response.headers.set('Cache-Control', 'private, max-age=60') // Cache for 1 minute
    response.headers.set('ETag', `group-switch-${groupId}-${Date.now()}`)

    return response

  } catch (error) {
    console.error('Error in optimized group switch:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}