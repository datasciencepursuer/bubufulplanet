import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { normalizeDate } from '@/lib/dateTimeUtils'
import { CACHE_TAGS, CACHE_DURATIONS } from '@/lib/cache'
import { unstable_cache } from 'next/cache'
import type { Trip, TripDay, Event } from '@prisma/client'
import type { Expense } from '@/types/expense'

// Server-side data fetching functions that work with Prisma directly

export async function getServerSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Unauthorized - No valid session found')
  }

  // Get user's current group
  const userGroup = await prisma.userGroup.findFirst({
    where: { userId: user.id },
    include: { group: true }
  })

  if (!userGroup) {
    throw new Error('No group found')
  }

  return { groupId: userGroup.groupId, userId: user.id }
}

export async function fetchTripServerSide(tripId: string): Promise<Trip> {
  const { groupId } = await getServerSession()
  
  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      groupId: groupId
    }
  })

  if (!trip) {
    throw new Error('Trip not found')
  }

  return {
    ...trip,
    startDate: normalizeDate(trip.startDate) as any,
    endDate: normalizeDate(trip.endDate) as any
  }
}

export async function fetchTripDaysServerSide(tripId: string): Promise<TripDay[]> {
  const { groupId } = await getServerSession()
  
  // Combine verification with data fetch using include
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, groupId },
    include: {
      tripDays: {
        orderBy: { dayNumber: 'asc' }
      }
    }
  })
  
  if (!trip) {
    throw new Error('Trip not found')
  }

  return trip.tripDays.map(day => ({
    ...day,
    date: normalizeDate(day.date) as any
  }))
}

export async function fetchEventsServerSide(tripId: string): Promise<Event[]> {
  const { groupId } = await getServerSession()
  
  const events = await prisma.event.findMany({
    where: {
      day: {
        trip: {
          id: tripId,
          groupId: groupId
        }
      }
    },
    orderBy: {
      startSlot: 'asc'
    }
  })

  return events
}

export async function fetchExpensesServerSide(tripId: string): Promise<Expense[]> {
  const { groupId } = await getServerSession()
  
  // Combine verification with data fetch using include
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, groupId },
    include: {
      expenses: {
        include: {
          participants: true,
          owner: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  })
  
  if (!trip) {
    throw new Error('Trip not found')
  }

  const expenses = trip.expenses

  // Transform Prisma data to match Expense interface
  return expenses.map(expense => ({
    id: expense.id,
    description: expense.description,
    amount: Number(expense.amount),
    category: expense.category || undefined,
    ownerId: expense.ownerId,
    tripId: expense.tripId,
    groupId: expense.groupId,
    dayId: expense.dayId || undefined,
    eventId: expense.eventId || undefined,
    createdAt: expense.createdAt.toISOString(),
    owner: {
      id: expense.owner.id,
      travelerName: expense.owner.travelerName
    },
    participants: expense.participants.map(p => ({
      id: p.id,
      expenseId: p.expenseId,
      participantId: p.participantId || undefined,
      externalName: p.externalName || undefined,
      splitPercentage: Number(p.splitPercentage),
      amountOwed: Number(p.amountOwed)
    }))
  })) as Expense[]
}

// Cached version of trip data fetch
export function fetchTripDataServerSideCached(tripId: string, groupId: string) {
  return unstable_cache(
    async () => {
      // Single query to get all trip data with verification
      const trip = await prisma.trip.findFirst({
        where: { id: tripId, groupId },
        include: {
          tripDays: {
            orderBy: { dayNumber: 'asc' },
            include: {
              events: {
                orderBy: { startSlot: 'asc' },
                include: {
                  expenses: true
                }
              }
            }
          },
          expenses: {
            include: {
              participants: true,
              owner: true
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      })

      if (!trip) {
        throw new Error('Trip not found')
      }

      // Extract and normalize data
      const normalizedTrip = {
        ...trip,
        startDate: normalizeDate(trip.startDate) as any,
        endDate: normalizeDate(trip.endDate) as any
      }

      const days = trip.tripDays.map(day => ({
        ...day,
        date: normalizeDate(day.date) as any
      }))

      // Flatten events from all days
      const events = trip.tripDays.flatMap(day => day.events)

      // Transform expenses to match interface
      const expenses = trip.expenses.map(expense => ({
        id: expense.id,
        description: expense.description,
        amount: Number(expense.amount),
        category: expense.category || undefined,
        ownerId: expense.ownerId,
        tripId: expense.tripId,
        groupId: expense.groupId,
        dayId: expense.dayId || undefined,
        eventId: expense.eventId || undefined,
        createdAt: expense.createdAt.toISOString(),
        owner: {
          id: expense.owner.id,
          travelerName: expense.owner.travelerName
        },
        participants: expense.participants.map(p => ({
          id: p.id,
          expenseId: p.expenseId,
          participantId: p.participantId || undefined,
          externalName: p.externalName || undefined,
          splitPercentage: Number(p.splitPercentage),
          amountOwed: Number(p.amountOwed)
        }))
      })) as Expense[]
      
      return { trip: normalizedTrip, days, events, expenses }
    },
    [`trip-data-${tripId}-${groupId}`],
    {
      revalidate: CACHE_DURATIONS.TRIP_DATA,
      tags: [
        CACHE_TAGS.TRIP_DATA(tripId),
        CACHE_TAGS.TRIP(tripId),
        CACHE_TAGS.TRIP_EVENTS(tripId),
        CACHE_TAGS.TRIP_EXPENSES(tripId)
      ]
    }
  )()
}

// Combined server-side data fetch - uses cached version
export async function fetchTripDataServerSide(tripId: string) {
  const { groupId } = await getServerSession()
  return fetchTripDataServerSideCached(tripId, groupId)
}