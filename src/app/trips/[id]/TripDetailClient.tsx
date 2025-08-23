'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, MapPin, Users, CalendarDays, Edit, Map, X, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import WeeklyCalendarView from '@/components/WeeklyCalendarView'
import DailyCalendarView from '@/components/DailyCalendarView'
import MobileCalendarView from '@/components/MobileCalendarView'
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
import { useTripData, useCreateExpense, useUpdateExpense, useDeleteExpense, useCreateEvent, useUpdateEvent, useDeleteEvent, useUpdateTrip } from '@/hooks/useTrip'
import { useDataCache } from '@/contexts/DataCacheContext'
import { useQueryClient } from '@tanstack/react-query'

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
  initialData?: {
    trip: Trip
    days: TripDay[]
    events: Event[]
    expenses: Expense[]
  }
}

export default function TripDetailClient({ tripId, initialData }: TripDetailClientProps) {
  const router = useRouter()
  const { success, error: notifyError } = useNotify()
  const queryClient = useQueryClient()
  
  // If we have initial data, prefill the cache
  useEffect(() => {
    if (initialData) {
      queryClient.setQueryData(['trip', tripId], initialData.trip)
      queryClient.setQueryData(['tripDays', tripId], initialData.days)
      queryClient.setQueryData(['events', tripId], initialData.events)
      queryClient.setQueryData(['expenses', tripId], initialData.expenses)
    }
  }, [initialData, tripId, queryClient])

  // Use React Query hooks for data fetching
  const {
    trip,
    days: tripDays = [],
    events = [],
    expenses = [],
    isLoading: loading,
    isError,
    error
  } = useTripData(tripId)
  
  // Get group members from cache context
  const { groupMembers, isLoadingMembers } = useDataCache()
  
  // React Query mutations
  const createExpenseMutation = useCreateExpense(tripId)
  const updateExpenseMutation = useUpdateExpense(tripId)
  const deleteExpenseMutation = useDeleteExpense(tripId)
  const createEventMutation = useCreateEvent(tripId)
  const updateEventMutation = useUpdateEvent(tripId)
  const deleteEventMutation = useDeleteEvent(tripId)
  const updateTripMutation = useUpdateTrip(tripId)
  const [calendarView, setCalendarView] = useState<'daily' | 'weekly'>('weekly')
  const [selectedDailyDate, setSelectedDailyDate] = useState<string | null>(null)
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set())
  const [newExpenseIds, setNewExpenseIds] = useState<Set<string>>(new Set())
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
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)


  // Helper function to get date from dayId
  const getDateForDayId = (dayId: string): string => {
    const day = tripDays?.find(d => d.id === dayId)
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
    const isEditing = selectedEvent !== undefined
    
    // Close modal immediately
    setIsModalOpen(false)
    setSelectedEvent(null)
    
    if (isEditing) {
      // Use React Query mutation for updates
      updateEventMutation.mutate({
        id: selectedEvent!.id,
        ...eventData
      })
    } else {
      // Use React Query mutation for creates (with optimistic updates)
      createEventMutation.mutate(eventData)
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
    
    // Clear deleting state
    setDeletingEventIds(prev => {
      const newSet = new Set(prev)
      newSet.delete(eventId)
      return newSet
    })
    
    // Use React Query mutation for delete (with optimistic updates)
    deleteEventMutation.mutate(eventId)
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
    // Close modal immediately
    setShowTripEditForm(false)
    
    // Use React Query mutation for trip updates
    updateTripMutation.mutate(tripData)
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
    const isEditing = selectedExpense !== undefined
    
    // Close modal immediately for better UX
    setShowExpenseModal(false)
    setSelectedExpense(undefined)
    setPrefilledEventId(null)
    
    if (isEditing) {
      // Use React Query mutation for updates
      updateExpenseMutation.mutate({
        id: selectedExpense!.id,
        ...(expenseData as UpdateExpenseRequest)
      })
    } else {
      // Use React Query mutation for creates (with optimistic updates)
      // Ensure tripId is included for create requests
      const createData: CreateExpenseRequest = {
        ...(expenseData as CreateExpenseRequest),
        tripId: tripId // Ensure tripId is always present for creates
      }
      createExpenseMutation.mutate(createData)
    }
    
    // Dispatch global event to refresh expense data across components
    window.dispatchEvent(new CustomEvent('expenseUpdated', { 
      detail: { 
        operation: isEditing ? 'update' : 'create',
        tripId: tripId 
      } 
    }))
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
    
    // Clear the expense to delete dialog
    setExpenseToDelete(null)
    
    // Use React Query mutation for delete (with optimistic updates)
    deleteExpenseMutation.mutate(expenseId)
    
    // Dispatch global event to refresh expense data across components
    window.dispatchEvent(new CustomEvent('expenseUpdated', { 
      detail: { 
        operation: 'delete',
        tripId: tripId,
        expenseId: expenseId 
      } 
    }))
  }

  // Show loading spinner only if we don't have initial data and we're loading
  if ((loading && !initialData) || isLoadingMembers) {
    return <BearGlobeLoader />
  }

  if (isError || !trip) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {error?.message || 'Trip not found'}
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
      <div className="flex-shrink-0 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        <div className="mb-4 lg:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 space-y-4 lg:space-y-0">
            <div className="flex items-center min-w-0">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => router.push('/app')}
                className="mr-2 lg:mr-4"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl lg:text-3xl font-bold text-gray-900 truncate">{trip.name}</h1>
            </div>
            
            {/* Mobile Action Button - Show only key actions */}
            <div className="flex gap-1 lg:hidden">
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
                className="gap-1"
              >
                <DollarSign className="h-4 w-4" />
                Add
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowExpensesPanel(true)}
                className="gap-1"
              >
                <DollarSign className="h-4 w-4" />
                {expenses.length}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowTripEditForm(true)}
                className="gap-1"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            </div>
            
            {/* Desktop Action Buttons */}
            <div className="hidden lg:flex gap-2">
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
          
          <div className="flex flex-wrap items-center gap-2 lg:gap-4 text-sm lg:text-base text-gray-600">
            {trip.destination && (
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                <span className="truncate">{trip.destination}</span>
              </div>
            )}
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              <span className="text-xs lg:text-sm">
                {formatDateForDisplay(trip.startDate)} - {formatDateForDisplay(trip.endDate)}
              </span>
            </div>
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-1" />
              {tripDays.length} days
            </div>
          </div>
        </div>

        {/* View Selector - Only show on desktop */}
        <div className="mb-6 hidden md:block">
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

        {/* Mobile Title */}
        <div className="mb-4 md:hidden">
          <h2 className="text-xl font-semibold">Trip Schedule</h2>
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
        {/* Mobile View - Always use mobile calendar on small screens */}
        <div className="md:hidden h-full">
          <MobileCalendarView
            key={`mobile-${trip.id}`}
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
        </div>

        {/* Desktop View - Use existing calendar views */}
        <div className="hidden md:block h-full">
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
        newExpenseIds={newExpenseIds}
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
            setShowExpenseModal(false)
            setSelectedExpense(undefined)
            setPrefilledEventId(null)
            deleteExpenseMutation.mutate(expenseId)
            
            // Dispatch global event to refresh expense data across components
            window.dispatchEvent(new CustomEvent('expenseUpdated', { 
              detail: { 
                operation: 'delete',
                tripId: tripId,
                expenseId: expenseId 
              } 
            }))
          }}
        />
      )}

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