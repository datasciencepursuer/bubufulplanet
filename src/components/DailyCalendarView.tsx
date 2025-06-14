'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { format, addDays, subDays, isSameDay, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Database } from '@/types/database'
import { EVENT_COLORS, getEventColor } from '@/lib/eventColors'

type TripDay = Database['public']['Tables']['trip_days']['Row']
type Event = Database['public']['Tables']['events']['Row']

interface DailyCalendarViewProps {
  tripStartDate: string
  tripEndDate: string
  tripDays: TripDay[]
  events: Event[]
  selectedEventId?: string | null
  newEventIds?: Set<string>
  onTimeSlotClick: (dayId: string, time: string) => void
  onTimeRangeSelect: (dayId: string, startTime: string, endTime: string) => void
  onEventClick: (event: Event) => void
  onEventSelect?: (event: Event, position: { top: number; left: number }) => void
  initialDate?: string | null
}

const TIME_SLOTS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00',
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', 
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
]

export default function DailyCalendarView({
  tripStartDate,
  tripEndDate,
  tripDays,
  events,
  selectedEventId,
  newEventIds,
  onTimeSlotClick,
  onTimeRangeSelect,
  onEventClick,
  onEventSelect,
  initialDate
}: DailyCalendarViewProps) {
  const startDate = parseISO(tripStartDate)
  const endDate = parseISO(tripEndDate)
  
  const [currentDate, setCurrentDate] = useState(() => 
    initialDate ? parseISO(initialDate) : startDate
  )

  // Update currentDate when initialDate changes
  useEffect(() => {
    if (initialDate) {
      setCurrentDate(parseISO(initialDate))
    }
  }, [initialDate])

  // Drag selection state
  const [dragState, setDragState] = useState<{
    isActive: boolean
    startDayId: string | null
    startTimeSlot: string | null
    currentDayId: string | null
    currentTimeSlot: string | null
  }>({
    isActive: false,
    startDayId: null,
    startTimeSlot: null,
    currentDayId: null,
    currentTimeSlot: null
  })

  // Click timing for distinguishing single vs double clicks
  const [clickState, setClickState] = useState<{
    clickedEventId: string | null
    clickTimeout: NodeJS.Timeout | null
  }>({
    clickedEventId: null,
    clickTimeout: null
  })

  // Cleanup click timeout on unmount
  useEffect(() => {
    return () => {
      if (clickState.clickTimeout) {
        clearTimeout(clickState.clickTimeout)
      }
    }
  }, [clickState.clickTimeout])

  // Helper function to get trip day for a specific date
  const getTripDayForDate = useCallback((date: Date) => {
    return tripDays.find(td => isSameDay(parseISO(td.date), date))
  }, [tripDays])

  // Helper function to get events for a specific date
  const getEventsForDate = useCallback((date: Date) => {
    const tripDay = getTripDayForDate(date)
    if (!tripDay) return []
    return events.filter(event => event.day_id === tripDay.id)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [events, getTripDayForDate])

  const currentTripDay = useMemo(() => getTripDayForDate(currentDate), [getTripDayForDate, currentDate])
  const eventsForDay = useMemo(() => getEventsForDate(currentDate), [getEventsForDate, currentDate])

  const goToPreviousDay = () => {
    const prevDay = subDays(currentDate, 1)
    if (prevDay >= startDate) {
      setCurrentDate(prevDay)
    }
  }

  const goToNextDay = () => {
    const nextDay = addDays(currentDate, 1)
    if (nextDay <= endDate) {
      setCurrentDate(nextDay)
    }
  }

  const getTimeSlotIndex = (timeSlot: string): number => {
    return TIME_SLOTS.indexOf(timeSlot)
  }

  const isSlotInSelection = (timeSlot: string): boolean => {
    if (!dragState.isActive || !dragState.startTimeSlot || !dragState.currentTimeSlot) return false
    
    const startIndex = getTimeSlotIndex(dragState.startTimeSlot)
    const currentIndex = getTimeSlotIndex(dragState.currentTimeSlot)
    const slotIndex = getTimeSlotIndex(timeSlot)
    
    const minIndex = Math.min(startIndex, currentIndex)
    const maxIndex = Math.max(startIndex, currentIndex)
    
    return slotIndex >= minIndex && slotIndex <= maxIndex
  }

  // Vertical drag handlers
  const handleMouseDown = (timeSlot: string, hasEvent: boolean) => {
    if (hasEvent || !currentTripDay) return
    
    setDragState({
      isActive: true,
      startDayId: currentTripDay.id,
      startTimeSlot: timeSlot,
      currentDayId: currentTripDay.id,
      currentTimeSlot: timeSlot
    })
  }

  const handleMouseEnter = (timeSlot: string) => {
    if (dragState.isActive && currentTripDay) {
      setDragState(prev => ({
        ...prev,
        currentDayId: currentTripDay.id,
        currentTimeSlot: timeSlot
      }))
    }
  }

  const handleMouseUp = useCallback(() => {
    if (dragState.isActive && dragState.startDayId && dragState.startTimeSlot && dragState.currentTimeSlot) {
      const startIndex = getTimeSlotIndex(dragState.startTimeSlot)
      const endIndex = getTimeSlotIndex(dragState.currentTimeSlot)
      
      const startTime = TIME_SLOTS[Math.min(startIndex, endIndex)]
      const endTimeIndex = Math.max(startIndex, endIndex) + 1
      const endTime = endTimeIndex < TIME_SLOTS.length ? TIME_SLOTS[endTimeIndex] : '23:00'
      
      if (startTime !== endTime) {
        onTimeRangeSelect(dragState.startDayId, startTime, endTime)
      } else {
        onTimeSlotClick(dragState.startDayId, startTime)
      }
    }
    
    setDragState({
      isActive: false,
      startDayId: null,
      startTimeSlot: null,
      currentDayId: null,
      currentTimeSlot: null
    })
  }, [dragState, onTimeRangeSelect, onTimeSlotClick])

  // Global mouse event listeners
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragState.isActive) {
        handleMouseUp()
      }
    }

    document.addEventListener('mouseup', handleGlobalMouseUp)
    
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [dragState.isActive, handleMouseUp])

  const canGoToPrevious = currentDate > startDate
  const canGoToNext = currentDate < endDate

  // Calculate default end time (1 hour after start time)
  const calculateDefaultEndTime = (startTime: string): string => {
    const [hours, minutes] = startTime.split(':').map(Number)
    let endHours = hours + 1
    let endMinutes = minutes
    
    if (endHours >= 24) {
      endHours = endHours % 24
    }
    
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
  }

  const getEventForTimeSlot = (timeSlot: string): Event | null => {
    return eventsForDay.find(event => {
      const eventStartTime = event.start_time
      const eventEndTime = event.end_time || calculateDefaultEndTime(eventStartTime)
      
      const slotMinutes = parseInt(timeSlot.split(':')[0]) * 60 + parseInt(timeSlot.split(':')[1])
      const startMinutes = parseInt(eventStartTime.split(':')[0]) * 60 + parseInt(eventStartTime.split(':')[1])
      const endMinutes = parseInt(eventEndTime.split(':')[0]) * 60 + parseInt(eventEndTime.split(':')[1])
      
      return slotMinutes >= startMinutes && slotMinutes < endMinutes
    }) || null
  }

  const getEventSpanInfo = (timeSlot: string): { event: Event | null, isFirst: boolean, isLast: boolean, totalSlots: number, durationMinutes: number } => {
    const event = getEventForTimeSlot(timeSlot)
    if (!event) return { event: null, isFirst: false, isLast: false, totalSlots: 0, durationMinutes: 0 }

    const eventStartTime = event.start_time
    const eventEndTime = event.end_time || calculateDefaultEndTime(eventStartTime)
    
    const startMinutes = parseInt(eventStartTime.split(':')[0]) * 60 + parseInt(eventStartTime.split(':')[1])
    const endMinutes = parseInt(eventEndTime.split(':')[0]) * 60 + parseInt(eventEndTime.split(':')[1])
    const slotMinutes = parseInt(timeSlot.split(':')[0]) * 60 + parseInt(timeSlot.split(':')[1])
    
    // Calculate actual duration in minutes
    const durationMinutes = endMinutes - startMinutes
    
    // Calculate total slots (each slot is 1 hour)
    const totalSlots = Math.ceil(durationMinutes / 60)
    const isFirst = slotMinutes === startMinutes
    const isLast = slotMinutes >= endMinutes - 60 && slotMinutes < endMinutes

    return { event, isFirst, isLast, totalSlots, durationMinutes }
  }

  const isWithinTripDates = (): boolean => {
    return currentDate >= startDate && currentDate <= endDate
  }

  const handleEventClick = useCallback((event: Event, e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Clear any existing timeout
    if (clickState.clickTimeout) {
      clearTimeout(clickState.clickTimeout)
    }
    
    // Check if this is a double click on the same event
    if (clickState.clickedEventId === event.id) {
      // Double click - edit event
      setClickState({ clickedEventId: null, clickTimeout: null })
      onEventClick(event)
    } else {
      // Calculate position immediately (before timeout) to avoid null reference
      const element = e.currentTarget as HTMLElement
      const position = element ? {
        top: element.getBoundingClientRect().top + window.scrollY,
        left: element.getBoundingClientRect().right + 10
      } : {
        top: 100,
        left: 400
      }
      
      // Single click - select event (with delay to detect double click)
      const timeout = setTimeout(() => {
        if (onEventSelect) {
          onEventSelect(event, position)
        }
        setClickState({ clickedEventId: null, clickTimeout: null })
      }, 300) // 300ms delay to detect double click
      
      setClickState({ 
        clickedEventId: event.id, 
        clickTimeout: timeout 
      })
    }
  }, [clickState, onEventClick, onEventSelect])

  return (
    <div className="bg-white rounded-lg border flex flex-col h-full">
      {/* Day Navigation */}
      <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={goToPreviousDay}
          disabled={!canGoToPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <div className="text-center">
          <h2 className="text-xl font-semibold">
            {format(currentDate, 'EEEE, MMMM d, yyyy')}
          </h2>
          {currentTripDay && (
            <p className="text-sm text-blue-600 mt-1">
              Day {currentTripDay.day_number} of trip
            </p>
          )}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={goToNextDay}
          disabled={!canGoToNext}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Daily Schedule */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full min-h-full">
          {TIME_SLOTS.map(timeSlot => {
            const eventSpan = getEventSpanInfo(timeSlot)
            const { event, isFirst, isLast, totalSlots, durationMinutes } = eventSpan
            const isClickable = currentTripDay && isWithinTripDates()
            const isInSelection = isSlotInSelection(timeSlot)
            
            return (
              <div
                key={`${currentDate.toISOString()}-${timeSlot}`}
                className={`flex border-b min-h-[80px] ${
                  isClickable ? 'hover:bg-gray-50' : ''
                } ${isInSelection ? 'bg-blue-200 hover:bg-blue-300' : ''}`}
              >
                {/* Time Label */}
                <div className="w-20 p-4 text-sm text-gray-500 border-r flex-shrink-0 flex items-start">
                  {format(new Date(`2000-01-01T${timeSlot}`), 'h:mm a')}
                </div>
                
                {/* Event Area */}
                <div
                  className={`flex-1 p-2 relative ${
                    isClickable ? 'cursor-pointer hover:bg-blue-50' : 'bg-gray-100'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    if (isClickable && currentTripDay && !event) {
                      handleMouseDown(timeSlot, false)
                    }
                  }}
                  onMouseEnter={() => {
                    if (isClickable && !event) {
                      handleMouseEnter(timeSlot)
                    }
                  }}
                  onClick={(e) => {
                    if (!isClickable || dragState.isActive || !currentTripDay) return
                    
                    // Get click position within the cell
                    const rect = e.currentTarget.getBoundingClientRect()
                    const relativeY = e.clientY - rect.top
                    const cellHeight = rect.height
                    
                    // Determine if click is in first or second half
                    const isSecondHalf = relativeY > cellHeight / 2
                    
                    // Determine the click time based on position
                    let clickTime = timeSlot
                    
                    if (event) {
                      // There's an event in this time slot
                      const eventStartMinutes = parseInt(event.start_time.split(':')[1])
                      const eventEndTime = event.end_time || event.start_time
                      const eventEndHour = parseInt(eventEndTime.split(':')[0])
                      const eventEndMinutes = parseInt(eventEndTime.split(':')[1])
                      const currentHour = parseInt(timeSlot.split(':')[0])
                      
                      // Check if event occupies the entire hour slot
                      const eventStartsThisHour = parseInt(event.start_time.split(':')[0]) === currentHour
                      const eventEndsAfterThisHour = eventEndHour > currentHour || (eventEndHour === currentHour && eventEndMinutes === 0 && eventEndHour > parseInt(event.start_time.split(':')[0]))
                      
                      if (eventStartsThisHour && eventStartMinutes === 0 && eventEndsAfterThisHour) {
                        // Event fills the entire hour, don't create new event
                        return
                      } else if (eventStartsThisHour && eventStartMinutes === 0 && eventEndMinutes === 30) {
                        // Event occupies first half, allow click in second half
                        if (isSecondHalf) {
                          clickTime = `${timeSlot.split(':')[0]}:30`
                        } else {
                          return // Click on event
                        }
                      } else if (eventStartsThisHour && eventStartMinutes === 30) {
                        // Event occupies second half, allow click in first half
                        if (!isSecondHalf) {
                          clickTime = timeSlot
                        } else {
                          return // Click on event
                        }
                      }
                    } else {
                      // No event in this slot, create based on where clicked
                      clickTime = isSecondHalf ? `${timeSlot.split(':')[0]}:30` : timeSlot
                    }
                    
                    onTimeSlotClick(currentTripDay.id, clickTime)
                  }}
                >
                  {event && isFirst ? (
                    <div
                      onClick={(e) => handleEventClick(event, e)}
                      data-event-id={event.id}
                      className={`cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 rounded-lg shadow-sm absolute left-2 right-2 overflow-hidden ${
                        durationMinutes <= 30 ? 'p-2' : 'p-3'
                      } ${newEventIds?.has(event.id) ? 'event-grow-animation' : ''} ${
                        selectedEventId === event.id ? 'ring-2 ring-teal-500 ring-offset-1' : ''
                      }`}
                      style={{
                        backgroundColor: event.color || EVENT_COLORS[0].color,
                        color: getEventColor(event.color || EVENT_COLORS[0].color).fontColor,
                        height: `${(durationMinutes / 60) * 80 - 16}px`,
                        top: `${(parseInt(event.start_time.split(':')[1]) / 60) * 80 + 8}px`,
                        zIndex: selectedEventId === event.id ? 15 : 10
                      }}
                    >
                      {durationMinutes <= 30 ? (
                        // Compact view for 30-minute events - title only with tooltip
                        <div className="flex items-center h-full">
                          <div className="font-medium text-left text-sm truncate" title={`${event.title}${event.location ? ` • ${event.location}` : ''} • ${format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}${event.end_time ? ` - ${format(new Date(`2000-01-01T${event.end_time}`), 'h:mm a')}` : ''}`}>
                            {event.title}
                          </div>
                        </div>
                      ) : durationMinutes <= 120 ? (
                        // Medium view for 1-2 hour events
                        <div className="flex flex-col justify-center h-full gap-1">
                          <div className="font-medium text-left text-lg truncate">{event.title}</div>
                          <div className="text-sm opacity-75 text-left">
                            {format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}
                            {event.end_time && ` - ${format(new Date(`2000-01-01T${event.end_time}`), 'h:mm a')}`}
                          </div>
                        </div>
                      ) : (
                        // Full view for longer events
                        <div className="flex flex-col justify-between h-full">
                          <div>
                            <div className="font-medium text-left text-lg mb-2 truncate">{event.title}</div>
                            {event.location && (
                              <div className="text-sm text-left opacity-90 mb-2 truncate">{event.location}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm opacity-75 text-left">
                              {format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}
                              {event.end_time && ` - ${format(new Date(`2000-01-01T${event.end_time}`), 'h:mm a')}`}
                            </div>
                            {event.notes && (
                              <div className="text-sm text-left opacity-90 mt-2 line-clamp-2">{event.notes}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : event && !isFirst ? (
                    // Empty div for non-first slots of multi-slot events to maintain layout
                    <div className="h-full" />
                  ) : isClickable ? (
                    <div className="h-full min-h-[76px]" />
                  ) : (
                    <div className="h-full min-h-[76px]" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 border-t bg-gray-50 text-sm text-gray-600 flex-shrink-0">
        <div className="space-y-1">
          <div>• <strong>Vertical drag:</strong> Select time range to create events</div>
          <div>• <strong>Click:</strong> Add single-hour event</div>
        </div>
      </div>
    </div>
  )
}