import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { normalizeDate } from '@/lib/dateTimeUtils'
import type { Trip, TripDay, Event } from '@prisma/client'
import type { Expense } from '@/types/expense'

// Server-side data fetching functions that work with Prisma directly

export async function getServerSession() {
  const cookieStore = await cookies()
  const groupId = cookieStore.get('vacation-planner-group-id')?.value
  const travelerName = cookieStore.get('vacation-planner-traveler-name')?.value

  if (!groupId || !travelerName) {
    throw new Error('Unauthorized - No valid session found')
  }

  return { groupId, travelerName }
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
  
  // Verify trip belongs to user's group
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, groupId }
  })
  
  if (!trip) {
    throw new Error('Trip not found')
  }

  const days = await prisma.tripDay.findMany({
    where: { tripId },
    orderBy: { dayNumber: 'asc' }
  })

  return days.map(day => ({
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
  
  // Verify trip belongs to user's group
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, groupId }
  })
  
  if (!trip) {
    throw new Error('Trip not found')
  }

  const expenses = await prisma.expense.findMany({
    where: { tripId },
    include: {
      participants: true,
      owner: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

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

// Combined server-side data fetch
export async function fetchTripDataServerSide(tripId: string) {
  const [trip, days, events, expenses] = await Promise.all([
    fetchTripServerSide(tripId),
    fetchTripDaysServerSide(tripId),
    fetchEventsServerSide(tripId),
    fetchExpensesServerSide(tripId),
  ])
  
  return { trip, days, events, expenses }
}