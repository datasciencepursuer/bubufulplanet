'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, MapPin, Users, CalendarDays, Edit, Map, X, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import WeeklyCalendarView from '@/components/WeeklyCalendarView'
import DailyCalendarView from '@/components/DailyCalendarView'
import EventModal from '@/components/EventModal'
import EventPropertiesPanel from '@/components/EventPropertiesPanel'
import TripForm from '@/components/TripForm'
import BearGlobeLoader from '@/components/BearGlobeLoader'
import PointsOfInterestView from '@/components/TripUtilities/PointsOfInterestView'
import ConfirmDialog from '@/components/ConfirmDialog'
import ExpenseModal from '@/components/ExpenseModal'
import TripExpensesPanel from '@/components/TripExpensesPanel'
import type { Trip, TripDay, Event, GroupMember } from '@prisma/client'
import type { Expense } from '@/types/expense'
import type { CreateExpenseRequest, UpdateExpenseRequest } from '@/types/expense'
import { useNotify } from '@/hooks/useNotify'
import { normalizeDate, createAbsoluteDate, calculateDefaultEndTime, formatDateForDisplay } from '@/lib/dateTimeUtils'

type EventInsert = Omit<Event, 'id' | 'createdAt'>

// API data format for events (camelCase) - matches EventModal and API
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

interface TripDetailClientProps {
  tripId: string
}

export default function TripDetailClient({ tripId }: TripDetailClientProps) {
  const router = useRouter()
  const { success, error: notifyError } = useNotify()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [tripDays, setTripDays] = useState<TripDay[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [calendarView, setCalendarView] = useState<'daily' | 'weekly'>('weekly')
  const [selectedDailyDate, setSelectedDailyDate] = useState<string | null>(null)
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set())
  const [deletingEventIds, setDeletingEventIds] = useState<Set<string>>(new Set())
  const [deletingExpenseIds, setDeletingExpenseIds] = useState<Set<string>>(new Set())
  const [selectedEventForPanel, setSelectedEventForPanel] = useState<Event | null>(null)


  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedDayId, setSelectedDayId] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [selectedEndTime, setSelectedEndTime] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')
  const [selectedEndDate, setSelectedEndDate] = useState<string>('')

  // Trip edit state
  const [showTripEditForm, setShowTripEditForm] = useState(false)
  
  // Points of Interest state
  const [showPointsOfInterest, setShowPointsOfInterest] = useState(false)
  
  // Expense state
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showExpensesPanel, setShowExpensesPanel] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | undefined>(undefined)
  const [prefilledEventId, setPrefilledEventId] = useState<string | null>(null)
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)

  const fetchTripData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch trip details
      const tripResponse = await fetch(`/api/trips?id=${tripId}`)
      if (!tripResponse.ok) {
        throw new Error('Failed to fetch trip')
      }
      const tripData = await tripResponse.json()
      
      if (!tripData.trips || tripData.trips.length === 0) {
        throw new Error('Trip not found')
      }
      
      setTrip(tripData.trips[0])

      // Fetch trip days
      const daysResponse = await fetch(`/api/trips/${tripId}/days`)
      if (daysResponse.ok) {
        const daysData = await daysResponse.json()
        setTripDays(daysData.tripDays || [])
      }

      // Fetch events
      const eventsResponse = await fetch(`/api/events?tripId=${tripId}`)
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json()
        setEvents(eventsData.events || [])
      }

      // Fetch expenses
      const expensesResponse = await fetch(`/api/events/expenses?tripId=${tripId}`)
      if (expensesResponse.ok) {
        const expensesData = await expensesResponse.json()
        setExpenses(expensesData.expenses || [])
      }
      
      // Fetch group members
      const membersResponse = await fetch('/api/groups/members', {
        credentials: 'include'
      })
      if (membersResponse.ok) {
        const membersData = await membersResponse.json()
        console.log('Group members fetched:', membersData.members)
        setGroupMembers(membersData.members || [])
      } else {
        console.error('Failed to fetch group members:', membersResponse.status)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    fetchTripData()
  }, [fetchTripData])

  // Helper function to get date from dayId
  const getDateForDayId = (dayId: string): string => {
    const day = tripDays.find(d => d.id === dayId)
    return day?.date ? normalizeDate(day.date) : normalizeDate(new Date())
  }


  const handleDateRangeSelect = (dayIds: string[]) => {
    console.log('Date range selected:', { dayIds })
    if (!dayIds.length) {
      console.error('No dayIds provided for date range select')
      notifyError('Error', 'Cannot create event - no days selected')
      return
    }
    // For multi-day events, use the first day
    setSelectedDayId(dayIds[0])
    setSelectedTime('09:00') // Default time
    setSelectedEndTime('')
    setSelectedEvent(null)
    setCurrentDate(getDateForDayId(dayIds[0]))
    setIsModalOpen(true)
  }

  const handleTimeSlotClick = (dayId: string, time: string, date?: string) => {
    if (!dayId) {
      console.error('No dayId provided for time slot click')
      notifyError('Error', 'Cannot create event - no day selected')
      return
    }
    
    // Use the provided date if available, otherwise fall back to dayId lookup
    const clickedDate = date || getDateForDayId(dayId)
    
    // Calculate default end time
    const endTime = calculateDefaultEndTime(time)
    
    // For both views, use the regular modal
    setSelectedDayId(dayId)
    setSelectedTime(time)
    setSelectedEndTime(endTime)
    setSelectedEvent(null)
    setCurrentDate(clickedDate)
    setIsModalOpen(true)
  }

  const handleTimeRangeSelect = (dayId: string, startTime: string, endTime: string, endDate?: string, startDate?: string) => {
    if (!dayId) {
      console.error('No dayId provided for time range select')
      notifyError('Error', 'Cannot create event - no day selected')
      return
    }
    
    // Use the provided startDate if available, otherwise fall back to dayId lookup
    const startDateStr = startDate || getDateForDayId(dayId)
    
    // For both views, use the regular modal
    setSelectedDayId(dayId)
    setSelectedTime(startTime)
    setSelectedEndTime(endTime)
    setSelectedEvent(null)
    setCurrentDate(startDateStr)
    
    // If endDate is provided (multi-day event), we'll need to handle it in the modal
    if (endDate) {
      setSelectedEndDate(endDate)
    }
    setIsModalOpen(true)
  }

  const handleEventClick = (event: Event) => {
    // For both views, use the regular modal for editing
    setSelectedEvent(event)
    setSelectedDayId(event.dayId)
    setSelectedTime('')
    setSelectedEndTime('')
    setCurrentDate(getDateForDayId(event.dayId))
    setIsModalOpen(true)
  }

  const handleEventSelect = (event: Event, position: { top: number; left: number }) => {
    // For both views, toggle the side panel
    if (selectedEventForPanel?.id === event.id) {
      setSelectedEventForPanel(null)
    } else {
      setSelectedEventForPanel(event)
    }
  }

  const handleClearSelection = () => {
    setSelectedEventForPanel(null)
  }

  const handleSaveEvent = async (eventData: EventApiData) => {
    try {
      if (selectedEvent) {
        // Optimistic update for existing event
        const updatedEvent: Event = {
          ...selectedEvent,
          title: eventData.title,
          startSlot: eventData.startSlot,
          endSlot: eventData.endSlot,
          location: eventData.location,
          notes: eventData.notes,
          weather: eventData.weather,
          loadout: eventData.loadout,
          color: eventData.color
        }
        
        // Update events state optimistically
        setEvents(prevEvents => 
          prevEvents.map(e => e.id === selectedEvent.id ? updatedEvent : e)
        )
        
        // Update selected event for panel if it's the same event
        if (selectedEventForPanel?.id === selectedEvent.id) {
          setSelectedEventForPanel(updatedEvent)
        }
        
        
        // Update existing event
        const response = await fetch(`/api/events/${selectedEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: eventData })
        })

        if (!response.ok) {
          // Revert optimistic update on error
          setEvents(prevEvents => 
            prevEvents.map(e => e.id === selectedEvent.id ? selectedEvent : e)
          )
          if (selectedEventForPanel?.id === selectedEvent.id) {
            setSelectedEventForPanel(selectedEvent)
          }
          
          const errorText = await response.text()
          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { error: errorText || response.statusText }
          }
          
          console.error('Event update failed:', {
            status: response.status,
            statusText: response.statusText,
            responseText: errorText,
            error: errorData
          })
          throw new Error(errorData.error || errorData.details || `Failed to update event: ${response.statusText}`)
        }
      } else {
        // Create new event with optimistic update
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const optimisticEvent: Event = {
          id: tempId,
          dayId: eventData.dayId,
          title: eventData.title,
          startSlot: eventData.startSlot,
          endSlot: eventData.endSlot,
          location: eventData.location,
          notes: eventData.notes,
          weather: eventData.weather,
          loadout: eventData.loadout,
          color: eventData.color,
          createdAt: new Date()
        }
        
        // Add optimistic event to UI immediately
        setEvents(prevEvents => [...prevEvents, optimisticEvent])
        setNewEventIds(prev => new Set(prev).add(tempId))
        
        try {
          const response = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: eventData })
          })

          if (!response.ok) {
            // Remove optimistic event on error
            setEvents(prevEvents => prevEvents.filter(e => e.id !== tempId))
            setNewEventIds(prev => {
              const newSet = new Set(prev)
              newSet.delete(tempId)
              return newSet
            })
            
            const errorText = await response.text()
            let errorData
            try {
              errorData = JSON.parse(errorText)
            } catch {
              errorData = { error: errorText || response.statusText }
            }
            
            console.error('Event creation failed:', {
              status: response.status,
              statusText: response.statusText,
              responseText: errorText,
              error: errorData
            })
            throw new Error(errorData.error || errorData.details || `Failed to create event: ${response.statusText}`)
          }
          
          // Get the created event to replace the temporary one
          const responseData = await response.json()
          if (responseData.event?.id) {
            // Replace temporary event with real event
            setEvents(prevEvents => 
              prevEvents.map(e => e.id === tempId ? responseData.event : e)
            )
            setNewEventIds(prev => {
              const newSet = new Set(prev)
              newSet.delete(tempId)
              newSet.add(responseData.event.id)
              return newSet
            })
            
            // Remove the ID from new events after animation completes
            setTimeout(() => {
              setNewEventIds(prev => {
                const next = new Set(prev)
                next.delete(responseData.event.id)
                return next
              })
            }, 1000)
          }
        } catch (error) {
          // Error handling is done above in the response check
          throw error
        }
      }

      // No need to refresh from server since we're using optimistic updates

    } catch (err) {
      console.error('Error saving event:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to save event'
      notifyError('Error', errorMessage + '. Please try again.')
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    // Mark event as being deleted for visual feedback
    setDeletingEventIds(prev => new Set([...prev, eventId]))
    
    // Clear any selected event states immediately
    if (selectedEventForPanel?.id === eventId) {
      setSelectedEventForPanel(null)
    }
    
    // Wait a brief moment for fade-out animation
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Optimistic update - remove the event from UI
    const previousEvents = events
    const previousExpenses = expenses
    
    setEvents(events.filter(e => e.id !== eventId))
    setExpenses(expenses.filter(e => e.eventId !== eventId))
    setDeletingEventIds(prev => {
      const newSet = new Set(prev)
      newSet.delete(eventId)
      return newSet
    })
    
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete event')
      }

      // Success! Show success message
      success('Event Deleted', 'Event deleted successfully!')
      
      // Optimistic update was successful, no need to refresh from server

    } catch (err) {
      console.error('Error deleting event:', err)
      // Revert the optimistic update on error
      setEvents(previousEvents)
      setExpenses(previousExpenses)
      
      // Show error message
      notifyError('Delete Failed', 'Failed to delete event. Please try again.')
    }
  }

  const handleDayHeaderClick = (date: string) => {
    setSelectedDailyDate(date)
    setCalendarView('daily')
  }

  const handleTripEdit = async (tripData: {
    name: string
    destination: string
    startDate: string
    endDate: string
  }) => {
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Failed to update trip: ${response.statusText}`)
      }

      const { trip: updatedTrip, datesChanged } = await response.json()
      
      // Update local state
      setTrip(updatedTrip)
      setShowTripEditForm(false)

      // If dates changed, refresh all data since trip days would have been regenerated
      if (datesChanged) {
        await fetchTripData()
        success('Trip Updated', 'Trip updated successfully. All events and expenses have been removed due to date changes.')
      } else {
        success('Trip Updated', 'Trip updated successfully!')
      }
    } catch (error) {
      console.error('Error updating trip:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update trip'
      notifyError('Update Failed', errorMessage + '. Please try again.')
    }
  }

  const handleDeleteTrip = () => {
    if (!trip) return
    setShowDeleteConfirm(true)
  }

  const handleDeleteTripConfirm = async () => {
    if (!trip) return
    
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete trip')
      }

      // Navigate back to the main app page
      router.push('/app')
    } catch (error) {
      console.error('Error deleting trip:', error)
      notifyError('Delete Failed', 'Failed to delete trip. Please try again.')
    }
  }
  
  const handleSaveExpense = async (expenseData: CreateExpenseRequest | UpdateExpenseRequest) => {
    try {
      const isEditing = selectedExpense !== undefined
      const url = isEditing ? `/api/expenses/${selectedExpense!.id}` : '/api/expenses'
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Expense save error:', errorData)
        if (errorData.details) {
          console.error('Validation details:', errorData.details)
        }
        throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} expense`)
      }

      // Show success message
      success('Expense Saved', `Expense ${isEditing ? 'updated' : 'created'} successfully!`)
      
      // Close modal and reset selected expense
      setShowExpenseModal(false)
      setSelectedExpense(undefined)
      
      // Refresh trip data to get updated expenses
      await fetchTripData()
    } catch (error) {
      console.error('Error saving expense:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save expense'
      notifyError('Save Failed', errorMessage + '. Please try again.')
    }
  }
  
  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(expense)
    setShowExpensesPanel(false)
    setShowExpenseModal(true)
  }
  
  const handleDeleteExpense = (expense: Expense) => {
    setExpenseToDelete(expense)
  }
  
  
  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return
    
    const expenseId = expenseToDelete.id
    
    try {
      // Start visual deletion feedback
      setDeletingExpenseIds(prev => new Set([...prev, expenseId]))
      
      // Clear the expense to delete dialog
      setExpenseToDelete(null)
      
      // Wait for fade-out animation
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Save previous state for potential rollback
      const previousExpenses = [...expenses]
      
      // Optimistically remove expense from UI
      setExpenses(prev => prev.filter(expense => expense.id !== expenseId))
      setDeletingExpenseIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(expenseId)
        return newSet
      })
      
      // Make API call
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete expense')
      }
      
      // Show success message
      success('Expense Deleted', 'Expense deleted successfully!')
      
    } catch (error) {
      console.error('Error deleting expense:', error)
      
      // Rollback optimistic update on error
      const previousExpenses = expenses.filter(expense => expense.id !== expenseId)
      if (previousExpenses.length !== expenses.length) {
        // Re-fetch to ensure data consistency on error
        await fetchTripData()
      }
      
      // Clear deleting state
      setDeletingExpenseIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(expenseId)
        return newSet
      })
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete expense'
      notifyError('Delete Failed', errorMessage + '. Please try again.')
    }
  }

  if (loading) {
    return <BearGlobeLoader />
  }

  if (error || !trip) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {error || 'Trip not found'}
          </h2>
          <Button onClick={() => router.push('/app')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => router.push('/app')}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-3xl font-bold text-gray-900">{trip.name}</h1>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  if (groupMembers.length === 0) {
                    notifyError('Error', 'Unable to add expenses. No group members found.')
                    return;
                  }
                  setSelectedExpense(undefined);
                  setPrefilledEventId(null);
                  setShowExpenseModal(true);
                }}
                className="gap-2"
              >
                <DollarSign className="h-4 w-4" />
                Add Expense
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowExpensesPanel(true)}
                className="gap-2"
              >
                <DollarSign className="h-4 w-4" />
                View Expenses ({expenses.length})
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowPointsOfInterest(true)}
                className="gap-2"
              >
                <Map className="h-4 w-4" />
                Points of Interest
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowTripEditForm(true)}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Trip
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-gray-600">
            {trip.destination && (
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                {trip.destination}
              </div>
            )}
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              {formatDateForDisplay(trip.startDate)} - {formatDateForDisplay(trip.endDate)}
            </div>
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-1" />
              {tripDays.length} days
            </div>
          </div>
        </div>

        {/* View Selector */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Trip Schedule</h2>
            <div className="flex items-center space-x-2">
              <Button
                variant={calendarView === 'daily' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCalendarView('daily')}
                className="gap-2"
              >
                <CalendarDays className="h-4 w-4" />
                Daily
              </Button>
              <Button
                variant={calendarView === 'weekly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCalendarView('weekly')}
                className="gap-2"
              >
                <Calendar className="h-4 w-4" />
                Weekly
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar View - Takes remaining height */}
      <div 
        className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-8"
        onClick={(e) => {
          // Close properties panel if clicking on empty space
          const target = e.target as HTMLElement
          const isCalendarClick = target.closest('.grid-cols-8') || 
                                 target.closest('.grid-cols-2') ||
                                 target.closest('[class*="calendar"]')
          
          if (!isCalendarClick) {
            handleClearSelection()
          }
        }}
      >
        {calendarView === 'weekly' ? (
          <WeeklyCalendarView
            key={`weekly-${trip.id}`}
            tripStartDate={trip.startDate ? normalizeDate(trip.startDate) : ''}
            tripEndDate={trip.endDate ? normalizeDate(trip.endDate) : ''}
            tripDays={tripDays}
            events={events}
            selectedEventId={selectedEventForPanel?.id}
            newEventIds={newEventIds}
            deletingEventIds={deletingEventIds}
            onTimeSlotClick={handleTimeSlotClick}
            onTimeRangeSelect={handleTimeRangeSelect}
            onEventClick={handleEventClick}
            onEventSelect={handleEventSelect}
            onDayHeaderClick={handleDayHeaderClick}
          />
        ) : (
          <DailyCalendarView
            key={`daily-${trip.id}`}
            tripStartDate={trip.startDate ? normalizeDate(trip.startDate) : ''}
            tripEndDate={trip.endDate ? normalizeDate(trip.endDate) : ''}
            tripDays={tripDays}
            events={events}
            selectedEventId={selectedEventForPanel?.id}
            newEventIds={newEventIds}
            deletingEventIds={deletingEventIds}
            onTimeSlotClick={handleTimeSlotClick}
            onTimeRangeSelect={handleTimeRangeSelect}
            onEventClick={handleEventClick}
            onEventSelect={handleEventSelect}
            onAddExpenseToEvent={(eventId) => {
              if (groupMembers.length === 0) {
                notifyError('Error', 'Unable to add expenses. No group members found.')
                return
              }
              setSelectedExpense(undefined)
              setPrefilledEventId(eventId)
              setShowExpenseModal(true)
            }}
            onDeleteEvent={handleDeleteEvent}
            initialDate={selectedDailyDate}
          />
        )}
      </div>

      {/* Side Event Properties Panel - For both weekly and daily views */}
      <EventPropertiesPanel
        selectedEvent={selectedEventForPanel}
        expenses={expenses}
        onEditEvent={handleEventClick}
        onClearSelection={handleClearSelection}
      />

      {/* Event Modal - For both views */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedEvent(null)
          setSelectedDayId('')
          setSelectedTime('')
          setSelectedEndTime('')
          setCurrentDate('')
          setSelectedEndDate('')
        }}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        event={selectedEvent}
        dayId={selectedDayId}
        startSlot={selectedTime}
        endSlot={selectedEndTime}
        tripStartDate={trip?.startDate ? normalizeDate(trip.startDate) : undefined}
        tripEndDate={trip?.endDate ? normalizeDate(trip.endDate) : undefined}
      />

      {/* Trip Edit Form */}
      {showTripEditForm && trip && (
        <TripForm
          isEdit={true}
          existingTrip={{
            id: trip.id,
            name: trip.name,
            destination: trip.destination,
            startDate: trip.startDate,
            endDate: trip.endDate
          }}
          onSubmit={handleTripEdit}
          onCancel={() => setShowTripEditForm(false)}
          onDelete={handleDeleteTrip}
          open={showTripEditForm}
        />
      )}

      {/* Points of Interest Modal */}
      {showPointsOfInterest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Points of Interest for {trip?.name}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPointsOfInterest(false)}
                className="p-1"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <PointsOfInterestView 
                tripId={tripId} 
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}


      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteTripConfirm}
        title="Delete Trip"
        message={trip ? `Are you sure you want to delete "${trip.name}"? This action cannot be undone and will delete all events and expenses.` : 'Are you sure you want to delete this trip?'}
        confirmText="Delete Trip"
        cancelText="Cancel"
        variant="destructive"
      />
      
      {/* Expense Modal */}
      {showExpenseModal && groupMembers.length > 0 && (
        <ExpenseModal
          isOpen={showExpenseModal}
          onClose={() => {
            setShowExpenseModal(false)
            setSelectedExpense(undefined)
            setPrefilledEventId(null)
          }}
          expense={selectedExpense}
          tripId={tripId}
          tripName={trip?.name}
          eventId={prefilledEventId || undefined}
          groupMembers={groupMembers}
          events={events}
          onSave={handleSaveExpense}
          onDelete={async (expenseId: string) => {
            try {
              // Start visual deletion feedback
              setDeletingExpenseIds(prev => new Set([...prev, expenseId]))
              
              // Close modal immediately
              setShowExpenseModal(false)
              setSelectedExpense(undefined)
              setPrefilledEventId(null)
              
              // Wait for fade-out animation
              await new Promise(resolve => setTimeout(resolve, 200))
              
              // Save previous state for potential rollback
              const previousExpenses = [...expenses]
              
              // Optimistically remove expense from UI
              setExpenses(prev => prev.filter(expense => expense.id !== expenseId))
              setDeletingExpenseIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(expenseId)
                return newSet
              })
              
              // Make API call
              const response = await fetch(`/api/expenses/${expenseId}`, {
                method: 'DELETE'
              })
              
              if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to delete expense')
              }
              
              // Show success message
              success('Expense Deleted', 'Expense deleted successfully!')
              
            } catch (error) {
              console.error('Error deleting expense:', error)
              
              // Rollback optimistic update on error
              const previousExpenses = expenses.filter(expense => expense.id !== expenseId)
              if (previousExpenses.length !== expenses.length) {
                // Re-fetch to ensure data consistency on error
                await fetchTripData()
              }
              
              // Clear deleting state
              setDeletingExpenseIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(expenseId)
                return newSet
              })
              
              const errorMessage = error instanceof Error ? error.message : 'Failed to delete expense'
              notifyError('Error', errorMessage + '. Please try again.')
            }
          }}
        />
      )}
      
      {/* Trip Expenses Panel */}
      <TripExpensesPanel
        expenses={expenses}
        events={events}
        isOpen={showExpensesPanel}
        onClose={() => setShowExpensesPanel(false)}
        onAddExpense={() => {
          if (groupMembers.length === 0) {
            notifyError('Error', 'Unable to add expenses. No group members found.')
            return;
          }
          setSelectedExpense(undefined);
          setPrefilledEventId(null);
          setShowExpensesPanel(false);
          setShowExpenseModal(true);
        }}
        onEditExpense={handleEditExpense}
        onDeleteExpense={handleDeleteExpense}
        deletingExpenseIds={deletingExpenseIds}
      />
      
      {/* Expense Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!expenseToDelete}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={confirmDeleteExpense}
        title="Delete Expense"
        message={expenseToDelete ? `Are you sure you want to delete this expense: "${expenseToDelete.description}"? This action cannot be undone.` : ''}
        confirmText="Delete Expense"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  )
}