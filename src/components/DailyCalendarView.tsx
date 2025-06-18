'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Event, TripDay } from '@prisma/client'
import { EVENT_COLORS, getEventColor } from '@/lib/eventColors'
import { getTripDateInfo, getTripDateStyles, normalizeDate } from '@/lib/tripDayUtils'
import { TIME_SLOTS, formatTimeSlot, getTimeSlotRange } from '@/lib/timeSlotUtils'

interface DailyCalendarViewProps {
  tripStartDate: string
  tripEndDate: string
  tripDays: TripDay[]
  events: Event[]
  selectedEventId?: string | null
  newEventIds?: Set<string>
  onTimeSlotClick: (dayId: string, startSlot: string, endSlot: string) => void
  onTimeRangeSelect: (dayId: string, startSlot: string, endSlot: string) => void
  onEventClick: (event: Event) => void
  onEventSelect?: (event: Event, position: { top: number; left: number }) => void
  initialDate?: string | null
}

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
    startSlot: string | null
    currentSlot: string | null
  }>({
    isActive: false,
    startSlot: null,
    currentSlot: null
  })

  // Get trip day for current date
  const currentTripDay = useMemo(() => {
    const targetDateStr = normalizeDate(currentDate)
    return tripDays.find(td => {
      const tripDayDateStr = normalizeDate(new Date(td.date))
      return targetDateStr === tripDayDateStr
    })
  }, [currentDate, tripDays])

  // Get events for current day
  const eventsForDay = useMemo(() => {
    if (!currentTripDay) return []
    return events
      .filter(event => event.dayId === currentTripDay.id)
      .sort((a, b) => a.startSlot.localeCompare(b.startSlot))
  }, [currentTripDay, events])

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
    if (!dragState.isActive || !dragState.startSlot || !dragState.currentSlot) return false
    
    const startIndex = getTimeSlotIndex(dragState.startSlot)
    const currentIndex = getTimeSlotIndex(dragState.currentSlot)
    const slotIndex = getTimeSlotIndex(timeSlot)
    
    const minIndex = Math.min(startIndex, currentIndex)
    const maxIndex = Math.max(startIndex, currentIndex)
    
    return slotIndex >= minIndex && slotIndex <= maxIndex
  }

  // Get event that occupies a specific time slot
  const getEventForTimeSlot = (timeSlot: string): Event | null => {
    return eventsForDay.find(event => {
      const eventSlots = getTimeSlotRange(event.startSlot, event.endSlot || event.startSlot)
      return eventSlots.includes(timeSlot)
    }) || null
  }

  // Drag handlers
  const handleMouseDown = (timeSlot: string) => {
    if (!currentTripDay || getEventForTimeSlot(timeSlot)) return
    
    setDragState({
      isActive: true,
      startSlot: timeSlot,
      currentSlot: timeSlot
    })
  }

  const handleMouseEnter = (timeSlot: string) => {
    if (dragState.isActive && currentTripDay && !getEventForTimeSlot(timeSlot)) {
      setDragState(prev => ({
        ...prev,
        currentSlot: timeSlot
      }))
    }
  }

  const handleMouseUp = useCallback(() => {
    if (dragState.isActive && dragState.startSlot && dragState.currentSlot && currentTripDay) {
      const startIndex = getTimeSlotIndex(dragState.startSlot)
      const endIndex = getTimeSlotIndex(dragState.currentSlot)
      
      const startSlot = TIME_SLOTS[Math.min(startIndex, endIndex)]
      const endSlot = TIME_SLOTS[Math.max(startIndex, endIndex)]
      
      if (startSlot === endSlot) {
        // Single slot click
        onTimeSlotClick(currentTripDay.id, startSlot, startSlot)
      } else {
        // Range selection
        onTimeRangeSelect(currentTripDay.id, startSlot, endSlot)
      }
    }
    
    setDragState({
      isActive: false,
      startSlot: null,
      currentSlot: null
    })
  }, [dragState, currentTripDay, onTimeSlotClick, onTimeRangeSelect])

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
  const isWithinTripDates = currentTripDay !== undefined

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
          {(() => {
            const dateInfo = getTripDateInfo(currentDate, tripStartDate, tripEndDate)
            const styles = getTripDateStyles(dateInfo)
            
            return styles.dayLabel.show && (
              <p className={styles.dayLabel.className}>
                {styles.dayLabel.text}{dateInfo.dateType === 'trip-day' ? ' of trip' : ''}
              </p>
            )
          })()}
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
            const event = getEventForTimeSlot(timeSlot)
            const isClickable = currentTripDay && isWithinTripDates && !event
            const isInSelection = isSlotInSelection(timeSlot)
            
            // Check if this is the first slot of an event
            const isEventStart = event && event.startSlot === timeSlot
            
            return (
              <div
                key={`${currentDate.toISOString()}-${timeSlot}`}
                className={`flex border-b min-h-[80px] ${
                  isClickable ? 'hover:bg-gray-50' : ''
                } ${isInSelection ? 'bg-blue-200 hover:bg-blue-300' : ''}`}
              >
                {/* Time Label */}
                <div className="w-20 p-4 text-sm text-gray-500 border-r flex-shrink-0 flex items-start">
                  {formatTimeSlot(timeSlot)}
                </div>
                
                {/* Event Area */}
                <div
                  className={`flex-1 p-2 relative ${
                    isClickable ? 'cursor-pointer hover:bg-blue-50' : 'bg-gray-100'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    if (isClickable) {
                      handleMouseDown(timeSlot)
                    }
                  }}
                  onMouseEnter={() => {
                    if (isClickable) {
                      handleMouseEnter(timeSlot)
                    }
                  }}
                >
                  {event && isEventStart ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(event)
                      }}
                      className={`cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 rounded-lg shadow-sm p-3 overflow-hidden ${
                        newEventIds?.has(event.id) ? 'event-grow-animation' : ''
                      } ${
                        selectedEventId === event.id ? 'ring-2 ring-teal-500 ring-offset-1' : ''
                      }`}
                      style={{
                        backgroundColor: event.color || EVENT_COLORS[0].color,
                        color: getEventColor(event.color || EVENT_COLORS[0].color).fontColor,
                        height: `${getTimeSlotRange(event.startSlot, event.endSlot || event.startSlot).length * 80 - 16}px`,
                        zIndex: selectedEventId === event.id ? 15 : 10
                      }}
                    >
                      <div className="flex flex-col justify-between h-full">
                        <div>
                          <div className="font-medium text-left text-lg mb-1 truncate">{event.title}</div>
                          {event.location && (
                            <div className="text-sm text-left opacity-90 mb-1 truncate">{event.location}</div>
                          )}
                          {event.notes && (
                            <div className="text-sm text-left opacity-75 mt-1 line-clamp-2 italic">{event.notes}</div>
                          )}
                        </div>
                        <div className="text-sm opacity-75 text-left">
                          {formatTimeSlot(event.startSlot)}
                          {event.endSlot && ` - ${formatTimeSlot(event.endSlot)}`}
                        </div>
                      </div>
                    </div>
                  ) : event && !isEventStart ? (
                    // Empty div for non-first slots of multi-slot events
                    <div className="h-full" />
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