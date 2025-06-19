'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { format, eachDayOfInterval, addDays, subDays, parseISO, min, max, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Event, TripDay } from '@prisma/client'
import { EVENT_COLORS, getEventColor } from '@/lib/eventColors'
import { getTripDateInfo, getTripDateStyles, normalizeDate } from '@/lib/tripDayUtils'
import { TIME_SLOTS, formatTimeSlot, getTimeSlotRange } from '@/lib/timeSlotUtils'

interface WeeklyCalendarViewProps {
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
  onDayHeaderClick?: (date: string) => void
}

export default function WeeklyCalendarView({
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
  onDayHeaderClick
}: WeeklyCalendarViewProps) {
  const startDate = parseISO(tripStartDate)
  const endDate = parseISO(tripEndDate)
  
  // Find the Monday-Sunday week that contains the trip start date
  const initialWeekStart = startOfWeek(startDate, { weekStartsOn: 1 }) // 1 = Monday
  
  // Current week start (always a Monday)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    return initialWeekStart
  })

  // Pre-render trip days map for quick lookup
  const tripDaysMap = useMemo(() => {
    const map = new Map()
    tripDays.forEach(td => {
      const dateStr = normalizeDate(new Date(td.date))
      map.set(dateStr, td)
    })
    return map
  }, [tripDays])

  // Drag selection state
  const [dragState, setDragState] = useState<{
    isActive: boolean
    startDayId: string | null
    startSlot: string | null
    currentDayId: string | null
    currentSlot: string | null
  }>({
    isActive: false,
    startDayId: null,
    startSlot: null,
    currentDayId: null,
    currentSlot: null
  })

  // Calculate current week (always Monday to Sunday)
  const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 }) // Sunday
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd })

  // Calculate navigation boundaries - can navigate to weeks that overlap with trip
  const firstWeekStart = startOfWeek(startDate, { weekStartsOn: 1 })
  const lastWeekStart = startOfWeek(endDate, { weekStartsOn: 1 })
  const canGoToPrevious = currentWeekStart > firstWeekStart
  const canGoToNext = currentWeekStart < lastWeekStart

  const tripDaysInWeek = useMemo(() => {
    return weekDays.map(day => {
      const dateStr = normalizeDate(day)
      const tripDay = tripDaysMap.get(dateStr)
      return { date: day, tripDay }
    })
  }, [weekDays, tripDaysMap])

  const eventsForWeek = useMemo(() => {
    const eventsByDay: Record<string, Event[]> = {}
    
    tripDaysInWeek.forEach(({ tripDay }) => {
      if (tripDay) {
        eventsByDay[tripDay.id] = events
          .filter(event => event.dayId === tripDay.id)
          .sort((a, b) => a.startSlot.localeCompare(b.startSlot))
      }
    })
    
    return eventsByDay
  }, [tripDaysInWeek, events])

  const goToPreviousDay = useCallback(() => {
    // For day navigation, go to previous week
    if (canGoToPrevious) {
      setCurrentWeekStart(subWeeks(currentWeekStart, 1))
    }
  }, [currentWeekStart, canGoToPrevious])

  const goToNextDay = useCallback(() => {
    // For day navigation, go to next week
    if (canGoToNext) {
      setCurrentWeekStart(addWeeks(currentWeekStart, 1))
    }
  }, [currentWeekStart, canGoToNext])

  const goToPreviousWeek = useCallback(() => {
    if (canGoToPrevious) {
      setCurrentWeekStart(subWeeks(currentWeekStart, 1))
    }
  }, [currentWeekStart, canGoToPrevious])

  const goToNextWeek = useCallback(() => {
    if (canGoToNext) {
      setCurrentWeekStart(addWeeks(currentWeekStart, 1))
    }
  }, [currentWeekStart, canGoToNext])

  // Get event that occupies a specific time slot for a specific day
  const getEventForTimeSlot = (dayId: string, timeSlot: string): Event | null => {
    const dayEvents = eventsForWeek[dayId] || []
    return dayEvents.find(event => {
      const eventSlots = getTimeSlotRange(event.startSlot, event.endSlot || event.startSlot)
      return eventSlots.includes(timeSlot)
    }) || null
  }

  // Drag handlers
  const handleMouseDown = (dayId: string, timeSlot: string) => {
    if (!dayId || getEventForTimeSlot(dayId, timeSlot)) return
    
    setDragState({
      isActive: true,
      startDayId: dayId,
      startSlot: timeSlot,
      currentDayId: dayId,
      currentSlot: timeSlot
    })
  }

  const handleMouseEnter = (dayId: string, timeSlot: string) => {
    if (dragState.isActive && dayId && !getEventForTimeSlot(dayId, timeSlot)) {
      setDragState(prev => ({
        ...prev,
        currentDayId: dayId,
        currentSlot: timeSlot
      }))
    }
  }

  const handleMouseUp = useCallback(() => {
    if (dragState.isActive && dragState.startDayId && dragState.startSlot && dragState.currentSlot) {
      const startSlotIndex = TIME_SLOTS.indexOf(dragState.startSlot)
      const endSlotIndex = TIME_SLOTS.indexOf(dragState.currentSlot)
      
      const startSlot = TIME_SLOTS[Math.min(startSlotIndex, endSlotIndex)]
      const endSlot = TIME_SLOTS[Math.max(startSlotIndex, endSlotIndex)]
      
      if (startSlot === endSlot && dragState.startDayId === dragState.currentDayId) {
        // Single slot click
        onTimeSlotClick(dragState.startDayId, startSlot, startSlot)
      } else {
        // Range selection (currently only same-day supported)
        if (dragState.startDayId === dragState.currentDayId) {
          onTimeRangeSelect(dragState.startDayId, startSlot, endSlot)
        } else {
          // For cross-day, just create on start day
          onTimeSlotClick(dragState.startDayId, dragState.startSlot, dragState.startSlot)
        }
      }
    }
    
    setDragState({
      isActive: false,
      startDayId: null,
      startSlot: null,
      currentDayId: null,
      currentSlot: null
    })
  }, [dragState, onTimeSlotClick, onTimeRangeSelect])

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

  // Check if a slot is in current selection
  const isSlotInSelection = (dayId: string, timeSlot: string): boolean => {
    if (!dragState.isActive || !dragState.startDayId || !dragState.startSlot || !dragState.currentSlot) return false
    
    // For now, only support same-day selections
    if (dragState.startDayId !== dayId || dragState.currentDayId !== dayId) return false
    
    const startIndex = TIME_SLOTS.indexOf(dragState.startSlot)
    const currentIndex = TIME_SLOTS.indexOf(dragState.currentSlot)
    const slotIndex = TIME_SLOTS.indexOf(timeSlot)
    
    const minIndex = Math.min(startIndex, currentIndex)
    const maxIndex = Math.max(startIndex, currentIndex)
    
    return slotIndex >= minIndex && slotIndex <= maxIndex
  }

  return (
    <div className="bg-white rounded-lg border flex flex-col h-full">
      {/* Week Navigation */}
      <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek} disabled={!canGoToPrevious}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToPreviousDay} disabled={!canGoToPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="text-center">
          <h2 className="text-xl font-semibold">
            {format(currentWeekStart, 'MMM d')} - {format(currentWeekEnd, 'MMM d, yyyy')}
          </h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={goToNextDay} disabled={!canGoToNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek} disabled={!canGoToNext}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-full">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b sticky top-0 bg-white z-10">
            <div className="p-3 text-sm font-medium text-gray-500 border-r">Time</div>
            {tripDaysInWeek.map(({ date, tripDay }) => {
              const dateInfo = getTripDateInfo(date, tripStartDate, tripEndDate)
              const styles = getTripDateStyles(dateInfo)
              
              return (
                <div
                  key={format(date, 'yyyy-MM-dd')}
                  className={`p-3 text-center border-r ${styles.container}`}
                  onClick={() => {
                    // Only allow day header clicks for actual trip days
                    if (onDayHeaderClick && dateInfo.isWithinTripDates) {
                      onDayHeaderClick(format(date, 'yyyy-MM-dd'))
                    }
                  }}
                >
                  <div className="text-sm font-medium">{format(date, 'EEE')}</div>
                  <div className={`text-lg ${styles.dateNumber}`}>
                    {format(date, 'd')}
                  </div>
                  {styles.dayLabel.show && (
                    <div className={`text-xs ${styles.dayLabel.className}`}>
                      {styles.dayLabel.text}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Time Slots */}
          {TIME_SLOTS.map(timeSlot => (
            <div key={timeSlot} className="grid grid-cols-8 border-b min-h-[60px]">
              {/* Time Label */}
              <div className="p-3 text-sm text-gray-500 border-r bg-gray-50 flex items-center">
                {formatTimeSlot(timeSlot)}
              </div>
              
              {/* Day Columns */}
              {tripDaysInWeek.map(({ date, tripDay }) => {
                const dayId = tripDay?.id || ''
                const event = dayId ? getEventForTimeSlot(dayId, timeSlot) : null
                const isClickable = tripDay && !event && dateInfo.isWithinTripDates
                const isInSelection = dayId ? isSlotInSelection(dayId, timeSlot) : false
                const isEventStart = event && event.startSlot === timeSlot
                
                // Get date info for styling Before/After days
                const dateInfo = getTripDateInfo(date, tripStartDate, tripEndDate)
                const isBeforeOrAfter = dateInfo.dateType === 'before' || dateInfo.dateType === 'after'
                const isOutsideRange = dateInfo.dateType === 'outside-range'
                
                return (
                  <div
                    key={`${format(date, 'yyyy-MM-dd')}-${timeSlot}`}
                    className={`border-r p-1 relative ${
                      isClickable 
                        ? 'cursor-pointer hover:bg-blue-50' 
                        : isBeforeOrAfter 
                        ? 'bg-amber-50 opacity-75 cursor-not-allowed' 
                        : isOutsideRange
                        ? 'bg-gray-100 opacity-50 cursor-not-allowed'
                        : 'bg-gray-50'
                    } ${isInSelection ? 'bg-blue-200 hover:bg-blue-300' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      if (isClickable) {
                        handleMouseDown(dayId, timeSlot)
                      }
                    }}
                    onMouseEnter={() => {
                      if (isClickable) {
                        handleMouseEnter(dayId, timeSlot)
                      }
                    }}
                  >
                    {event && isEventStart ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          // Call both event click and event select for properties panel
                          onEventClick(event)
                          if (onEventSelect) {
                            const rect = e.currentTarget.getBoundingClientRect()
                            onEventSelect(event, { 
                              top: rect.bottom + window.scrollY + 5, 
                              left: rect.left + window.scrollX 
                            })
                          }
                        }}
                        className={`cursor-pointer hover:shadow-lg transition-all duration-200 rounded text-xs p-1 overflow-hidden ${
                          newEventIds?.has(event.id) ? 'event-grow-animation' : ''
                        } ${
                          selectedEventId === event.id ? 'ring-1 ring-teal-500' : ''
                        }`}
                        style={{
                          backgroundColor: event.color || EVENT_COLORS[0].color,
                          color: getEventColor(event.color || EVENT_COLORS[0].color).fontColor,
                          height: `${getTimeSlotRange(event.startSlot, event.endSlot || event.startSlot).length * 60 - 8}px`,
                          zIndex: selectedEventId === event.id ? 15 : 10
                        }}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        {event.location && (
                          <div className="opacity-75 truncate">{event.location}</div>
                        )}
                      </div>
                    ) : event && !isEventStart ? (
                      // Empty div for non-first slots of multi-slot events
                      <div className="h-full" />
                    ) : (
                      <div className="h-full min-h-[52px]" />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 border-t bg-gray-50 text-sm text-gray-600 flex-shrink-0">
        <div className="space-y-1">
          <div>• <strong>Click day headers:</strong> Switch to daily view</div>
          <div>• <strong>Drag time slots:</strong> Create time range events</div>
          <div>• <strong>Click time slots:</strong> Create single-hour events</div>
        </div>
      </div>
    </div>
  )
}