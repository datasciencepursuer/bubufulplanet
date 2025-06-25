'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, DollarSign, Calendar, Clock, Edit, MapPin, FileText } from 'lucide-react'
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
  deletingEventIds?: Set<string>
  onTimeSlotClick: (dayId: string, startSlot: string, endSlot: string) => void
  onTimeRangeSelect: (dayId: string, startSlot: string, endSlot: string) => void
  onEventClick: (event: Event) => void
  onEventSelect?: (event: Event, position: { top: number; left: number }) => void
  onAddExpenseToEvent?: (eventId: string) => void
  initialDate?: string | null
}

export default function DailyCalendarView({
  tripStartDate,
  tripEndDate,
  tripDays,
  events,
  selectedEventId,
  newEventIds,
  deletingEventIds,
  onTimeSlotClick,
  onTimeRangeSelect,
  onEventClick,
  onEventSelect,
  onAddExpenseToEvent,
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

  // Double-click detection state
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null)
  const [lastClickedEventId, setLastClickedEventId] = useState<string | null>(null)
  

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
      const startIndex = TIME_SLOTS.indexOf(event.startSlot)
      const slotIndex = TIME_SLOTS.indexOf(timeSlot)
      
      if (startIndex === -1 || slotIndex === -1) return false
      
      // Handle events with end slot
      if (event.endSlot) {
        if (event.endSlot === '24:00') {
          // Event ends at midnight - include all slots from start to end of day
          return slotIndex >= startIndex
        }
        
        const endIndex = TIME_SLOTS.indexOf(event.endSlot)
        if (endIndex !== -1) {
          // Normal case - check if slot is within event range
          return slotIndex >= startIndex && slotIndex < endIndex
        }
      }
      
      // No end slot - just check if it's the start slot
      return slotIndex === startIndex
    }) || null
  }

  // Handle event click with double-click detection
  const handleEventClick = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (clickTimer && lastClickedEventId === event.id) {
      // Double click detected
      clearTimeout(clickTimer)
      setClickTimer(null)
      setLastClickedEventId(null)
      onEventClick(event) // This opens the edit modal
    } else {
      // Single click
      if (clickTimer) {
        clearTimeout(clickTimer)
      }
      
      // Set timer for single click action
      const timer = setTimeout(() => {
        // Show event details panel after delay
        if (onEventSelect) {
          onEventSelect(event, { top: 0, left: 0 })
        }
        setClickTimer(null)
        setLastClickedEventId(null)
      }, 300) // 300ms delay to wait for potential double-click
      
      setClickTimer(timer)
      setLastClickedEventId(event.id)
    }
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
        // Single slot click - create 1-hour time slot
        const startIndex = getTimeSlotIndex(startSlot)
        const endIndex = Math.min(startIndex + 1, TIME_SLOTS.length - 1)
        const endSlotForSingle = TIME_SLOTS[endIndex]
        onTimeSlotClick(currentTripDay.id, startSlot, endSlotForSingle)
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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimer) {
        clearTimeout(clickTimer)
      }
    }
  }, [clickTimer])


  const canGoToPrevious = currentDate > startDate
  const canGoToNext = currentDate < endDate
  const isWithinTripDates = currentTripDay !== undefined


  return (
    <div className="bg-white rounded-lg border flex flex-col h-full">
      {/* Enhanced Day Navigation */}
      <div className="flex justify-between items-center p-6 border-b gradient-bg flex-shrink-0">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={goToPreviousDay}
          disabled={!canGoToPrevious}
          className="shadow-sm hover:shadow-md transition-shadow"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-1">
            {format(currentDate, 'EEEE, MMMM d')}
          </h2>
          <p className="text-sm text-green-100">{format(currentDate, 'yyyy')}</p>
          {(() => {
            const dateInfo = getTripDateInfo(currentDate, tripStartDate, tripEndDate)
            const styles = getTripDateStyles(dateInfo)
            
            return styles.dayLabel.show && (
              <div className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                {styles.dayLabel.text}{dateInfo.dateType === 'trip-day' ? ' of trip' : ''}
              </div>
            )
          })()}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={goToNextDay}
          disabled={!canGoToNext}
          className="shadow-sm hover:shadow-md transition-shadow"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b bg-gray-50 flex gap-3">
        <Button 
          variant="default" 
          size="sm"
          onClick={() => {
            if (currentTripDay && isWithinTripDates) {
              onTimeSlotClick(currentTripDay.id, '09:00', '10:00')
            }
          }}
          disabled={!currentTripDay || !isWithinTripDates}
          className="shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      {/* Daily Schedule List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Events Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-blue-500" />
                Events ({eventsForDay.length})
              </h3>
            </div>
            
            {eventsForDay.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-lg font-medium mb-2">No events scheduled</p>
                <p className="text-sm mb-4">Start planning your day by adding events</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    if (currentTripDay && isWithinTripDates) {
                      onTimeSlotClick(currentTripDay.id, '09:00', '10:00')
                    }
                  }}
                  disabled={!currentTripDay || !isWithinTripDates}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Event
                </Button>
              </div>
            ) : (
              <div className="space-y-0">
                {(() => {
                  const eventsWithGaps = []
                  const sortedEvents = eventsForDay.sort((a, b) => a.startSlot.localeCompare(b.startSlot))
                  
                  sortedEvents.forEach((event, index) => {
                    // Add the event
                    eventsWithGaps.push(
                      <div
                        key={event.id}
                        className={`border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${
                          selectedEventId === event.id ? 'ring-2 ring-blue-500 ring-offset-1 shadow-md' : ''
                        } ${
                          newEventIds?.has(event.id) ? 'event-grow-animation' : ''
                        } ${
                          deletingEventIds?.has(event.id) ? 'opacity-30 scale-95' : ''
                        }`}
                        style={{
                          borderLeftColor: event.color || EVENT_COLORS[0].color,
                          borderLeftWidth: '4px'
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onEventSelect) {
                            onEventSelect(event, { top: 0, left: 0 })
                          }
                        }}
                        onDoubleClick={() => onEventClick(event)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-lg text-gray-800">{event.title}</h4>
                              {event.location && (
                                <div className="flex items-center text-sm text-gray-600">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  <span className="truncate">{event.location}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center text-sm text-gray-600 mb-2">
                              <Clock className="h-4 w-4 mr-1" />
                              <span>
                                {formatTimeSlot(event.startSlot)}
                                {event.endSlot && ` - ${formatTimeSlot(event.endSlot)}`}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {onAddExpenseToEvent && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onAddExpenseToEvent(event.id)
                                }}
                                className="h-10 w-10 p-0"
                                title="Add expense to this event"
                              >
                                <DollarSign className="h-5 w-5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                onEventClick(event)
                              }}
                              className="h-10 w-10 p-0"
                              title="Edit event"
                            >
                              <Edit className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                        
                        {event.notes && (
                          <div className="text-sm text-gray-700 mb-3 bg-gray-50 p-3 rounded-lg">
                            <FileText className="h-4 w-4 inline mr-1" />
                            {event.notes}
                          </div>
                        )}
                        
                      </div>
                    )
                    
                    // Check if there's a gap before the next event
                    const nextEvent = sortedEvents[index + 1]
                    if (nextEvent) {
                      const currentEventEnd = event.endSlot || event.startSlot
                      const nextEventStart = nextEvent.startSlot
                      
                      // Get the indices to check for gaps
                      const currentEndIndex = TIME_SLOTS.indexOf(currentEventEnd)
                      const nextStartIndex = TIME_SLOTS.indexOf(nextEventStart)
                      
                      // If there's a gap (more than 1 slot between events)
                      if (nextStartIndex > currentEndIndex + 1) {
                        const gapStartTime = TIME_SLOTS[currentEndIndex + 1] || currentEventEnd
                        const gapEndTime = TIME_SLOTS[nextStartIndex - 1] || nextEventStart
                        
                        eventsWithGaps.push(
                          <div key={`gap-${event.id}-${nextEvent.id}`} className="my-3">
                            <div className="flex items-center justify-center py-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50 hover:bg-gray-100/50 transition-colors cursor-pointer"
                                 onClick={() => {
                                   if (currentTripDay && isWithinTripDates) {
                                     onTimeSlotClick(currentTripDay.id, gapStartTime, gapEndTime)
                                   }
                                 }}>
                              <div className="text-center text-gray-500">
                                <Clock className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                                <p className="text-sm font-medium">Free time</p>
                                <p className="text-xs">
                                  {formatTimeSlot(gapStartTime)} - {formatTimeSlot(nextEventStart)}
                                </p>
                                <p className="text-xs text-blue-600 mt-1 hover:text-blue-800">Click to add event</p>
                              </div>
                            </div>
                          </div>
                        )
                      } else {
                        // Small gap - just add spacing
                        eventsWithGaps.push(
                          <div key={`small-gap-${event.id}-${nextEvent.id}`} className="h-3" />
                        )
                      }
                    }
                  })
                  
                  return eventsWithGaps
                })()}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}