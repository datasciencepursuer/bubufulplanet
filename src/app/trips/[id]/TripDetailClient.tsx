'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, MapPin, Users, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import WeeklyCalendarView from '@/components/WeeklyCalendarView'
import DailyCalendarView from '@/components/DailyCalendarView'
import EventModal from '@/components/EventModal'
import PersistentEventModal from '@/components/PersistentEventModal'
import EventPropertiesPanel from '@/components/EventPropertiesPanel'
import type { Trip, TripDay, Event, Expense } from '@prisma/client'
import { normalizeDate } from '@/lib/tripDayUtils'

type EventInsert = Omit<Event, 'id' | 'createdAt'>

// API data format for events (snake_case) - matches EventModal
type EventApiData = {
  title: string
  start_time: string
  end_time: string | null
  start_date: string
  end_date: string | null
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
  const [trip, setTrip] = useState<Trip | null>(null)
  const [tripDays, setTripDays] = useState<TripDay[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [calendarView, setCalendarView] = useState<'daily' | 'weekly'>('weekly')
  const [selectedDailyDate, setSelectedDailyDate] = useState<string | null>(null)
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set())
  const [selectedEventForPanel, setSelectedEventForPanel] = useState<Event | null>(null)
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number } | null>(null)
  
  // Persistent modal state for daily view
  const [persistentModalEvent, setPersistentModalEvent] = useState<Event | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedDayId, setSelectedDayId] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [selectedEndTime, setSelectedEndTime] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')
  const [selectedEndDate, setSelectedEndDate] = useState<string>('')

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
      alert('Error: Cannot create event - no days selected')
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

  const handleTimeSlotClick = (dayId: string, time: string) => {
    console.log('Time slot clicked:', { dayId, time })
    if (!dayId) {
      console.error('No dayId provided for time slot click')
      alert('Error: Cannot create event - no day selected')
      return
    }
    
    // Parse the time to calculate end time
    const [hours, minutes] = time.split(':').map(Number)
    let endHours = hours
    let endMinutes = minutes
    
    // Default to 1 hour duration, or 30 minutes if starting at :30
    if (minutes === 30) {
      endHours = hours + 1
      endMinutes = 0
    } else {
      endHours = hours + 1
      endMinutes = 0
    }
    
    // Format end time
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
    
    if (calendarView === 'daily') {
      // For daily view, clear any selected event and enter creation mode in persistent modal
      setPersistentModalEvent(null)
      setIsEditMode(true)
      setSelectedDayId(dayId)
      setSelectedTime(time)
      setSelectedEndTime(endTime)
      setCurrentDate(getDateForDayId(dayId))
    } else {
      // For weekly view, use the regular modal
      setSelectedDayId(dayId)
      setSelectedTime(time)
      setSelectedEndTime(endTime)
      setSelectedEvent(null)
      setCurrentDate(getDateForDayId(dayId))
      setIsModalOpen(true)
    }
  }

  const handleTimeRangeSelect = (dayId: string, startTime: string, endTime: string, endDate?: string) => {
    console.log('Time range selected:', { dayId, startTime, endTime, endDate })
    if (!dayId) {
      console.error('No dayId provided for time range select')
      alert('Error: Cannot create event - no day selected')
      return
    }
    
    // Set the date for the event
    const startDateStr = getDateForDayId(dayId)
    
    if (calendarView === 'daily') {
      // For daily view, clear any selected event and enter creation mode in persistent modal
      setPersistentModalEvent(null)
      setIsEditMode(true)
      setSelectedDayId(dayId)
      setSelectedTime(startTime)
      setSelectedEndTime(endTime)
      setCurrentDate(startDateStr)
      if (endDate) {
        setSelectedEndDate(endDate)
      }
    } else {
      // For weekly view, use the regular modal
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
  }

  const handleEventClick = (event: Event) => {
    if (calendarView === 'daily') {
      // For daily view, set the event for persistent modal and enter edit mode
      setPersistentModalEvent(event)
      setIsEditMode(true)
    } else {
      // For weekly view, use the regular modal
      setSelectedEvent(event)
      setSelectedDayId(event.dayId)
      setSelectedTime('')
      setSelectedEndTime('')
      setCurrentDate(event.startDate ? normalizeDate(event.startDate) : normalizeDate(new Date()))
      setIsModalOpen(true)
    }
  }

  const handleEventSelect = (event: Event, position: { top: number; left: number }) => {
    if (calendarView === 'daily') {
      // For daily view, set the event for persistent modal preview (not edit mode)
      setPersistentModalEvent(event)
      setIsEditMode(false)
    } else {
      // For weekly view, use the floating panel
      setSelectedEventForPanel(event)
      setPanelPosition(position)
    }
  }

  const handleClearSelection = () => {
    setSelectedEventForPanel(null)
    setPanelPosition(null)
  }

  const handleSaveEvent = async (
    eventData: EventApiData, 
    expenses: { description: string; amount: number; category?: string }[]
  ) => {
    try {
      if (selectedEvent) {
        // Update existing event
        const response = await fetch(`/api/events/${selectedEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: eventData, expenses })
        })

        if (!response.ok) {
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
        // Create new event
        const response = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: eventData, expenses })
        })

        if (!response.ok) {
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
        
        // Get the created event to track its ID
        const responseData = await response.json()
        if (responseData.event?.id) {
          setNewEventIds(prev => new Set(prev).add(responseData.event.id))
          // Remove the ID from new events after animation completes
          setTimeout(() => {
            setNewEventIds(prev => {
              const next = new Set(prev)
              next.delete(responseData.event.id)
              return next
            })
          }, 1000)
        }
      }

      // Refresh events and expenses
      const eventsResponse = await fetch(`/api/events?tripId=${tripId}`)
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json()
        setEvents(eventsData.events || [])
      }

      const expensesResponse = await fetch(`/api/events/expenses?tripId=${tripId}`)
      if (expensesResponse.ok) {
        const expensesData = await expensesResponse.json()
        setExpenses(expensesData.expenses || [])
      }

    } catch (err) {
      console.error('Error saving event:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to save event'
      alert(errorMessage + '. Please try again.')
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete event')
      }

      // Refresh events and expenses
      const eventsResponse = await fetch(`/api/events?tripId=${tripId}`)
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json()
        setEvents(eventsData.events || [])
      }

      const expensesResponse = await fetch(`/api/events/expenses?tripId=${tripId}`)
      if (expensesResponse.ok) {
        const expensesData = await expensesResponse.json()
        setExpenses(expensesData.expenses || [])
      }

    } catch (err) {
      console.error('Error deleting event:', err)
      alert('Failed to delete event. Please try again.')
    }
  }

  const handleDayHeaderClick = (date: string) => {
    setSelectedDailyDate(date)
    setCalendarView('daily')
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
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
          <div className="flex items-center mb-4">
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
          
          <div className="flex flex-wrap items-center gap-4 text-gray-600">
            {trip.destination && (
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                {trip.destination}
              </div>
            )}
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
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
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-8">
        {calendarView === 'weekly' ? (
          <WeeklyCalendarView
            key={`weekly-${trip.id}`}
            tripStartDate={trip.startDate ? new Date(trip.startDate).toISOString().split('T')[0] : ''}
            tripEndDate={trip.endDate ? new Date(trip.endDate).toISOString().split('T')[0] : ''}
            tripDays={tripDays}
            events={events}
            selectedEventId={selectedEventForPanel?.id}
            newEventIds={newEventIds}
            onTimeSlotClick={handleTimeSlotClick}
            onTimeRangeSelect={handleTimeRangeSelect}
            onEventClick={handleEventClick}
            onEventSelect={handleEventSelect}
            onDayHeaderClick={handleDayHeaderClick}
          />
        ) : (
          <div className="grid grid-cols-2 gap-6 h-full">
            <DailyCalendarView
              key={`daily-${trip.id}`}
              tripStartDate={trip.startDate ? new Date(trip.startDate).toISOString().split('T')[0] : ''}
              tripEndDate={trip.endDate ? new Date(trip.endDate).toISOString().split('T')[0] : ''}
              tripDays={tripDays}
              events={events}
              selectedEventId={persistentModalEvent?.id}
              newEventIds={newEventIds}
              onTimeSlotClick={handleTimeSlotClick}
              onTimeRangeSelect={handleTimeRangeSelect}
              onEventClick={handleEventClick}
              onEventSelect={handleEventSelect}
              initialDate={selectedDailyDate}
            />
            <PersistentEventModal
              selectedEvent={persistentModalEvent}
              expenses={expenses}
              onSave={handleSaveEvent}
              onDelete={handleDeleteEvent}
              dayId={selectedDayId}
              selectedTime={selectedTime}
              selectedEndTime={selectedEndTime}
              currentDate={currentDate}
              selectedEndDate={selectedEndDate}
              tripStartDate={trip?.startDate ? new Date(trip.startDate).toISOString().split('T')[0] : undefined}
              tripEndDate={trip?.endDate ? new Date(trip.endDate).toISOString().split('T')[0] : undefined}
              isEditMode={isEditMode}
              onEditModeChange={setIsEditMode}
            />
          </div>
        )}
      </div>

      {/* Floating Event Properties Panel - Only for weekly view */}
      {calendarView === 'weekly' && (
        <EventPropertiesPanel
          selectedEvent={selectedEventForPanel}
          expenses={expenses}
          position={panelPosition}
          onEditEvent={handleEventClick}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Event Modal - Only for weekly view */}
      {calendarView === 'weekly' && (
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
          selectedTime={selectedTime}
          selectedEndTime={selectedEndTime}
          currentDate={currentDate}
          selectedEndDate={selectedEndDate}
          tripStartDate={trip?.startDate ? new Date(trip.startDate).toISOString().split('T')[0] : undefined}
          tripEndDate={trip?.endDate ? new Date(trip.endDate).toISOString().split('T')[0] : undefined}
        />
      )}
    </div>
  )
}