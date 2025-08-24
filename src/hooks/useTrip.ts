'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Trip, TripDay, Event } from '@prisma/client'
import type { Expense, CreateExpenseRequest, UpdateExpenseRequest } from '@/types/expense'
import { useNotify } from '@/hooks/useNotify'
import { createGroupedFetch } from '@/lib/groupUtils'

// Event API data format
type EventApiData = {
  dayId: string
  title: string
  startSlot: string
  endSlot: string | null
  location: string | null
  notes: string | null
  weather: string | null
  loadout: string | null
  color: string
}

// API functions with group context
async function fetchTrip(tripId: string): Promise<Trip> {
  const groupedFetch = createGroupedFetch()
  const response = await groupedFetch(`/api/trips?id=${tripId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch trip')
  }
  const data = await response.json()
  if (!data.trips || data.trips.length === 0) {
    throw new Error('Trip not found')
  }
  return data.trips[0]
}

async function fetchTripDays(tripId: string): Promise<TripDay[]> {
  const groupedFetch = createGroupedFetch()
  const response = await groupedFetch(`/api/trips/${tripId}/days`)
  if (!response.ok) {
    throw new Error('Failed to fetch trip days')
  }
  const data = await response.json()
  return data.days || []
}

async function fetchEvents(tripId: string): Promise<Event[]> {
  const groupedFetch = createGroupedFetch()
  const response = await groupedFetch(`/api/events?tripId=${tripId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch events')
  }
  const data = await response.json()
  return data.events || []
}

async function fetchExpenses(tripId: string): Promise<Expense[]> {
  const groupedFetch = createGroupedFetch()
  const response = await groupedFetch(`/api/events/expenses?tripId=${tripId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch expenses')
  }
  const data = await response.json()
  return data.expenses || []
}

// Combined trip data fetch
export async function fetchTripData(tripId: string) {
  const [trip, days, events, expenses] = await Promise.all([
    fetchTrip(tripId),
    fetchTripDays(tripId),
    fetchEvents(tripId),
    fetchExpenses(tripId),
  ])
  
  return { trip, days, events, expenses }
}

// React Query hooks
export function useTrip(tripId: string) {
  return useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => fetchTrip(tripId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!tripId,
  })
}

export function useTripDays(tripId: string) {
  return useQuery({
    queryKey: ['tripDays', tripId],
    queryFn: () => fetchTripDays(tripId),
    staleTime: 5 * 60 * 1000, // 5 minutes - days change less frequently
    enabled: !!tripId,
  })
}

export function useEvents(tripId: string) {
  return useQuery({
    queryKey: ['events', tripId],
    queryFn: () => fetchEvents(tripId),
    staleTime: 1 * 60 * 1000, // 1 minute - events change more frequently
    enabled: !!tripId,
  })
}

export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: ['expenses', tripId],
    queryFn: () => fetchExpenses(tripId),
    staleTime: 1 * 60 * 1000, // 1 minute - expenses change frequently
    enabled: !!tripId,
  })
}

// Combined trip data hook
export function useTripData(tripId: string) {
  const tripQuery = useTrip(tripId)
  const daysQuery = useTripDays(tripId)
  const eventsQuery = useEvents(tripId)
  const expensesQuery = useExpenses(tripId)

  return {
    trip: tripQuery.data,
    days: daysQuery.data,
    events: eventsQuery.data || [],
    expenses: expensesQuery.data || [],
    isLoading: tripQuery.isLoading || daysQuery.isLoading || eventsQuery.isLoading || expensesQuery.isLoading,
    isError: tripQuery.isError || daysQuery.isError || eventsQuery.isError || expensesQuery.isError,
    error: tripQuery.error || daysQuery.error || eventsQuery.error || expensesQuery.error,
    isSuccess: tripQuery.isSuccess && daysQuery.isSuccess && eventsQuery.isSuccess && expensesQuery.isSuccess,
  }
}

// Mutation hooks
export function useCreateExpense(tripId: string) {
  const queryClient = useQueryClient()
  const { success, error: notifyError } = useNotify()

  return useMutation({
    mutationFn: async (expenseData: CreateExpenseRequest) => {
      const groupedFetch = createGroupedFetch()
      const response = await groupedFetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create expense')
      }

      return response.json()
    },
    onMutate: async (newExpense) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['expenses', tripId] })

      // Snapshot the previous value
      const previousExpenses = queryClient.getQueryData<Expense[]>(['expenses', tripId])

      // Optimistically update the cache
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const optimisticExpense: Expense = {
        id: tempId,
        description: newExpense.description,
        amount: newExpense.amount,
        category: newExpense.category || undefined,
        ownerId: newExpense.ownerId,
        tripId: newExpense.tripId!,
        groupId: '', // Will be filled by server response
        dayId: newExpense.dayId || undefined,
        eventId: newExpense.eventId || undefined,
        participants: newExpense.participants?.map(p => ({
          id: `temp-participant-${Math.random().toString(36).substr(2, 9)}`,
          expenseId: tempId,
          participantId: p.participantId || undefined,
          externalName: p.externalName || undefined,
          splitPercentage: p.splitPercentage,
          amountOwed: 0 // Temporary value for optimistic update
        })) || [],
        owner: {
          id: newExpense.ownerId,
          travelerName: 'Loading...' // Will be filled by server response
        },
        createdAt: new Date().toISOString()
      }

      queryClient.setQueryData<Expense[]>(['expenses', tripId], (old) => 
        old ? [optimisticExpense, ...old] : [optimisticExpense]
      )

      return { previousExpenses, tempId }
    },
    onSuccess: (data, variables, context) => {
      // Replace temp expense with real one
      if (data.expense?.id && context?.tempId) {
        queryClient.setQueryData<Expense[]>(['expenses', tripId], (old) =>
          old ? old.map(expense => 
            expense.id === context.tempId ? data.expense : expense
          ) : [data.expense]
        )
      }
      success('Expense Created', 'Expense created successfully!')
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousExpenses) {
        queryClient.setQueryData(['expenses', tripId], context.previousExpenses)
      }
      notifyError('Error', error.message + '. Please try again.')
    },
    onSettled: () => {
      // Always refetch after mutation completes
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] })
    },
  })
}

export function useUpdateExpense(tripId: string) {
  const queryClient = useQueryClient()
  const { success, error: notifyError } = useNotify()

  return useMutation({
    mutationFn: async ({ id, ...expenseData }: UpdateExpenseRequest & { id: string }) => {
      const groupedFetch = createGroupedFetch()
      const response = await groupedFetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update expense')
      }

      return response.json()
    },
    onSuccess: () => {
      success('Expense Updated', 'Expense updated successfully!')
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] })
    },
    onError: (error) => {
      notifyError('Error', error.message + '. Please try again.')
    },
  })
}

export function useDeleteExpense(tripId: string) {
  const queryClient = useQueryClient()
  const { success, error: notifyError } = useNotify()

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const groupedFetch = createGroupedFetch()
      const response = await groupedFetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete expense')
      }

      return response.json()
    },
    onMutate: async (expenseId) => {
      // Cancel queries
      await queryClient.cancelQueries({ queryKey: ['expenses', tripId] })

      // Snapshot previous value
      const previousExpenses = queryClient.getQueryData<Expense[]>(['expenses', tripId])

      // Optimistically remove expense
      queryClient.setQueryData<Expense[]>(['expenses', tripId], (old) =>
        old ? old.filter(expense => expense.id !== expenseId) : []
      )

      return { previousExpenses }
    },
    onSuccess: () => {
      success('Expense Deleted', 'Expense deleted successfully!')
    },
    onError: (error, variables, context) => {
      // Rollback
      if (context?.previousExpenses) {
        queryClient.setQueryData(['expenses', tripId], context.previousExpenses)
      }
      notifyError('Error', error.message + '. Please try again.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] })
    },
  })
}

// Event mutation hooks
export function useCreateEvent(tripId: string) {
  const queryClient = useQueryClient()
  const { success, error: notifyError } = useNotify()

  return useMutation({
    mutationFn: async (eventData: EventApiData) => {
      const groupedFetch = createGroupedFetch()
      const response = await groupedFetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: eventData }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create event')
      }

      return response.json()
    },
    onMutate: async (newEvent) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['events', tripId] })

      // Snapshot the previous value
      const previousEvents = queryClient.getQueryData<Event[]>(['events', tripId])

      // Optimistically update the cache
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const optimisticEvent: Event = {
        id: tempId,
        dayId: newEvent.dayId,
        title: newEvent.title,
        startSlot: newEvent.startSlot,
        endSlot: newEvent.endSlot,
        location: newEvent.location,
        notes: newEvent.notes,
        weather: newEvent.weather,
        loadout: newEvent.loadout,
        color: newEvent.color,
        createdAt: new Date(),
      }

      queryClient.setQueryData<Event[]>(['events', tripId], (old) => 
        old ? [...old, optimisticEvent] : [optimisticEvent]
      )

      // Trigger animation for the temp ID immediately
      window.dispatchEvent(new CustomEvent('newEventCreated', { 
        detail: { eventId: tempId } 
      }))

      return { previousEvents, tempId }
    },
    onSuccess: (data, variables, context) => {
      // Replace temp event with real one
      if (data.event?.id && context?.tempId) {
        queryClient.setQueryData<Event[]>(['events', tripId], (old) =>
          old ? old.map(event => 
            event.id === context.tempId ? data.event : event
          ) : [data.event]
        )
        
        // Transfer animation state from temp ID to real ID
        window.dispatchEvent(new CustomEvent('eventIdChanged', { 
          detail: { oldId: context.tempId, newId: data.event.id } 
        }))
      }
      success('Event Created', 'Event created successfully!')
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousEvents) {
        queryClient.setQueryData(['events', tripId], context.previousEvents)
      }
      notifyError('Error', error.message + '. Please try again.')
    },
    // No onSettled callback to prevent any cache interference after successful creation
  })
}

export function useUpdateEvent(tripId: string) {
  const queryClient = useQueryClient()
  const { success, error: notifyError } = useNotify()

  return useMutation({
    mutationFn: async ({ id, ...eventData }: EventApiData & { id: string }) => {
      const groupedFetch = createGroupedFetch()
      const response = await groupedFetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: eventData }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update event')
      }

      return response.json()
    },
    onMutate: async ({ id, ...newEvent }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['events', tripId] })

      // Snapshot the previous value
      const previousEvents = queryClient.getQueryData<Event[]>(['events', tripId])

      // Optimistically update the cache
      queryClient.setQueryData<Event[]>(['events', tripId], (old) =>
        old ? old.map(event => 
          event.id === id ? { ...event, ...newEvent } : event
        ) : []
      )

      return { previousEvents }
    },
    onSuccess: () => {
      success('Event Updated', 'Event updated successfully!')
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousEvents) {
        queryClient.setQueryData(['events', tripId], context.previousEvents)
      }
      notifyError('Error', error.message + '. Please try again.')
    },
    onSettled: (data, error) => {
      // Only invalidate on error to refetch fresh data
      // On success, our optimistic update should already be correct
      if (error) {
        queryClient.invalidateQueries({ queryKey: ['events', tripId] })
      }
    },
  })
}

export function useDeleteEvent(tripId: string) {
  const queryClient = useQueryClient()
  const { success, error: notifyError } = useNotify()

  return useMutation({
    mutationFn: async (eventId: string) => {
      const groupedFetch = createGroupedFetch()
      const response = await groupedFetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete event')
      }

      return response.json()
    },
    onMutate: async (eventId) => {
      // Cancel queries
      await queryClient.cancelQueries({ queryKey: ['events', tripId] })
      await queryClient.cancelQueries({ queryKey: ['expenses', tripId] })

      // Snapshot previous values
      const previousEvents = queryClient.getQueryData<Event[]>(['events', tripId])
      const previousExpenses = queryClient.getQueryData<Expense[]>(['expenses', tripId])

      // Optimistically remove event and related expenses
      queryClient.setQueryData<Event[]>(['events', tripId], (old) =>
        old ? old.filter(event => event.id !== eventId) : []
      )
      queryClient.setQueryData<Expense[]>(['expenses', tripId], (old) =>
        old ? old.filter(expense => expense.eventId !== eventId) : []
      )

      return { previousEvents, previousExpenses }
    },
    onSuccess: () => {
      success('Event Deleted', 'Event deleted successfully!')
    },
    onError: (error, variables, context) => {
      // Rollback
      if (context?.previousEvents) {
        queryClient.setQueryData(['events', tripId], context.previousEvents)
      }
      if (context?.previousExpenses) {
        queryClient.setQueryData(['expenses', tripId], context.previousExpenses)
      }
      notifyError('Error', error.message + '. Please try again.')
    },
    onSettled: (data, error) => {
      // Only invalidate on error to refetch fresh data
      // On success, our optimistic update should already be correct
      if (error) {
        queryClient.invalidateQueries({ queryKey: ['events', tripId] })
        queryClient.invalidateQueries({ queryKey: ['expenses', tripId] })
      }
    },
  })
}

// Trip mutation hooks
export function useUpdateTrip(tripId: string) {
  const queryClient = useQueryClient()
  const { success, error: notifyError } = useNotify()

  return useMutation({
    mutationFn: async (tripData: { name: string, destination: string, startDate: string, endDate: string }) => {
      const groupedFetch = createGroupedFetch()
      const response = await groupedFetch(`/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Failed to update trip: ${response.statusText}`)
      }

      return response.json()
    },
    onMutate: async (newTripData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['trip', tripId] })

      // Snapshot the previous value
      const previousTrip = queryClient.getQueryData(['trip', tripId])

      // Optimistically update the cache
      queryClient.setQueryData(['trip', tripId], (old: any) =>
        old ? { ...old, ...newTripData } : null
      )

      return { previousTrip }
    },
    onSuccess: (data) => {
      // Update with real data from server
      if (data.trip) {
        queryClient.setQueryData(['trip', tripId], data.trip)
      }

      // If dates changed, invalidate all dependent data
      if (data.datesChanged) {
        queryClient.invalidateQueries({ queryKey: ['tripDays', tripId] })
        queryClient.invalidateQueries({ queryKey: ['events', tripId] })
        queryClient.invalidateQueries({ queryKey: ['expenses', tripId] })
        success('Trip Updated', 'Trip updated successfully. All events and expenses have been removed due to date changes.')
      } else {
        success('Trip Updated', 'Trip updated successfully!')
      }
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousTrip) {
        queryClient.setQueryData(['trip', tripId], context.previousTrip)
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to update trip'
      notifyError('Update Failed', errorMessage + '. Please try again.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
    },
  })
}