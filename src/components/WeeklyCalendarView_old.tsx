'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { format, eachDayOfInterval, addDays, subDays, parseISO, min, max, addWeeks, subWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachWeekOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Event, TripDay } from '@prisma/client'
import { EVENT_COLORS, getEventColor } from '@/lib/eventColors'
import { getTripDateInfo, getTripDateStyles, normalizeDate } from '@/lib/tripDayUtils'
import { TIME_SLOTS, formatTimeSlot, getTimeSlotRange, getNextTimeSlot } from '@/lib/timeSlotUtils'

interface WeeklyCalendarViewProps {
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
  onDayHeaderClick?: (date: string) => void
}

export default function WeeklyCalendarView({
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

  // Monthly calendar state
  const [currentMonth, setCurrentMonth] = useState(() => {
    return startOfMonth(startDate)
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

  // Double-click detection state
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null)
  const [lastClickedEventId, setLastClickedEventId] = useState<string | null>(null)

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
        // Single slot click - create 1 hour event
        const nextSlot = getNextTimeSlot(startSlot)
        onTimeSlotClick(dragState.startDayId, startSlot, nextSlot)
      } else {
        // Range selection (currently only same-day supported)
        if (dragState.startDayId === dragState.currentDayId) {
          // Add one slot to include the end hour
          const maxSlotIndex = Math.max(startSlotIndex, endSlotIndex) + 1
          const adjustedEndSlot = maxSlotIndex < TIME_SLOTS.length ? TIME_SLOTS[maxSlotIndex] : '24:00'
          onTimeRangeSelect(dragState.startDayId, startSlot, adjustedEndSlot)
        } else {
          // For cross-day, just create 1 hour event on start day
          const nextSlot = getNextTimeSlot(dragState.startSlot)
          onTimeSlotClick(dragState.startDayId, dragState.startSlot, nextSlot)
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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimer) {
        clearTimeout(clickTimer)
      }
    }
  }, [clickTimer])

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

  // Monthly calendar helpers
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentMonth])

  const handleMonthNavigation = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1))
  }

  const handleDateClick = (date: Date) => {
    // Navigate to the week containing this date
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    setCurrentWeekStart(weekStart)
  }

  return (
    <div className="flex h-screen bg-white fixed inset-0 z-50">
      {/* Left Sidebar with Mini Calendar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Mini Calendar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex space-x-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleMonthNavigation('prev')}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleMonthNavigation('next')}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Mini Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day Headers */}
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
              <div key={index} className="h-8 flex items-center justify-center text-xs font-medium text-gray-500">
                {day}
              </div>
            ))}
            
            {/* Calendar Days */}
            {monthDays.map((day) => {
              const isCurrentWeek = day >= currentWeekStart && day < addDays(currentWeekStart, 7)
              const isInTrip = day >= startDate && day <= endDate
              const isToday = isSameDay(day, new Date())
              const isCurrentMonth = isSameMonth(day, currentMonth)
              
              return (
                <button
                  key={day.toString()}
                  onClick={() => handleDateClick(day)}
                  className={`h-8 flex items-center justify-center text-sm rounded-md transition-colors ${
                    !isCurrentMonth 
                      ? 'text-gray-300'
                      : isCurrentWeek
                        ? 'bg-teal-100 text-teal-900 font-medium'
                        : isInTrip
                          ? 'text-teal-600 hover:bg-teal-50'
                          : isToday
                            ? 'bg-blue-600 text-white font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>

        {/* Trip Info */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Trip Details</h3>
          <div className="text-sm text-gray-600">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="h-4 w-4 text-teal-600" />
              <span>{format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Viewing: {format(currentWeekStart, 'MMM d')} - {format(currentWeekEnd, 'MMM d')}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 flex-1">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <div className="text-xs text-gray-600">
              • <strong>Click day headers:</strong> Switch to daily view
            </div>
            <div className="text-xs text-gray-600">
              • <strong>Drag time slots:</strong> Create time range events
            </div>
            <div className="text-xs text-gray-600">
              • <strong>Click time slots:</strong> Create single-hour events
            </div>
          </div>
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek} disabled={!canGoToPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextWeek} disabled={!canGoToNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              {format(currentWeekStart, 'MMMM d')} - {format(currentWeekEnd, 'd, yyyy')}
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date()
              const weekStart = startOfWeek(today, { weekStartsOn: 1 })
              setCurrentWeekStart(weekStart)
            }}
            className="text-teal-600 border-teal-200 hover:bg-teal-50"
          >
            Today
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Day Headers */}
            <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
              <div className="p-3 text-xs font-medium text-gray-500 border-r border-gray-200 w-16">
                GMT{format(new Date(), 'xxx')}
              </div>
              {tripDaysInWeek.map(({ date, tripDay }) => {
                const dateInfo = getTripDateInfo(date, tripStartDate, tripEndDate)
                const isToday = isSameDay(date, new Date())
                
                return (
                  <div
                    key={format(date, 'yyyy-MM-dd')}
                    className="p-3 text-center border-r border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      if (onDayHeaderClick) {
                        onDayHeaderClick(format(date, 'yyyy-MM-dd'))
                      }
                    }}
                  >
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      {format(date, 'EEE')}
                    </div>
                    <div className={`text-2xl font-normal ${
                      isToday 
                        ? 'bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto' 
                        : dateInfo.isWithinTripDates 
                          ? 'text-gray-900' 
                          : 'text-gray-400'
                    }`}>
                      {format(date, 'd')}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Time Slots Grid */}
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-8" style={{ minHeight: `${TIME_SLOTS.length * 60}px` }}>
                {/* Time Column */}
                <div className="border-r border-gray-200 bg-gray-50">
                  {TIME_SLOTS.map((timeSlot, index) => (
                    <div 
                      key={timeSlot} 
                      className="h-[60px] border-b border-gray-100 flex items-start justify-end pr-3 pt-2"
                    >
                      {index > 0 && (
                        <span className="text-xs text-gray-500 -mt-2">
                          {formatTimeSlot(timeSlot)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Day Columns */}
                {tripDaysInWeek.map(({ date, tripDay }) => (
                  <div key={format(date, 'yyyy-MM-dd')} className="border-r border-gray-200 relative">
                    {TIME_SLOTS.map((timeSlot) => {
                      const dateInfo = getTripDateInfo(date, tripStartDate, tripEndDate)
                      const dayId = tripDay?.id || ''
                      const event = dayId ? getEventForTimeSlot(dayId, timeSlot) : null
                      const isClickable = tripDay && !event && dateInfo.isWithinTripDates
                      const isInSelection = dayId ? isSlotInSelection(dayId, timeSlot) : false
                      const isEventStart = event && event.startSlot === timeSlot
                      const isOutsideRange = dateInfo.dateType === 'outside-range'
                      
                      return (
                        <div
                          key={`${format(date, 'yyyy-MM-dd')}-${timeSlot}`}
                          className={`h-[60px] border-b border-gray-100 relative ${
                            isClickable 
                              ? 'hover:bg-blue-50 cursor-pointer' 
                              : isOutsideRange 
                                ? 'bg-gray-25' 
                                : ''
                          } ${isInSelection ? 'bg-teal-100' : ''}`}
                          onMouseDown={isClickable ? (e) => handleDragStart(e, dayId, timeSlot) : undefined}
                          onMouseEnter={isClickable ? () => handleDragEnter(dayId, timeSlot) : undefined}
                          onMouseUp={isClickable ? () => handleDragEnd() : undefined}
                          onClick={isClickable && !dragState ? () => onTimeSlotClick(dayId, timeSlot, getNextTimeSlot(timeSlot)) : undefined}
                        >
                          {isEventStart && (
                            <div
                              key={event.id}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation()
                                
                                if (lastClickedEventId === event.id && clickTimer) {
                                  // Double click - edit event
                                  clearTimeout(clickTimer)
                                  setClickTimer(null)
                                  setLastClickedEventId(null)
                                  onEventClick(event)
                                } else {
                                  // Single click
                                  if (clickTimer) {
                                    clearTimeout(clickTimer)
                                  }
                                  
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  const position = { 
                                    top: rect.bottom + window.scrollY + 5, 
                                    left: rect.left + window.scrollX 
                                  }
                                  
                                  const timer = setTimeout(() => {
                                    if (onEventSelect) {
                                      onEventSelect(event, position)
                                    }
                                    setClickTimer(null)
                                    setLastClickedEventId(null)
                                  }, 300)
                                  
                                  setClickTimer(timer)
                                  setLastClickedEventId(event.id)
                                }
                              }}
                              className={`absolute left-1 right-1 cursor-pointer hover:shadow-lg transition-all duration-200 rounded-md text-xs p-2 overflow-hidden ${
                                newEventIds?.has(event.id) ? 'event-grow-animation' : ''
                              } ${
                                deletingEventIds?.has(event.id) ? 'event-shrink-animation opacity-50' : ''
                              } ${
                                selectedEventId === event.id ? 'ring-2 ring-blue-400' : ''
                              }`}
                              style={{
                                backgroundColor: getEventColor(event.color).background,
                                borderLeft: `4px solid ${getEventColor(event.color).border}`,
                                color: getEventColor(event.color).text,
                                height: `${getEventHeight(event)}px`,
                                zIndex: 10
                              }}
                            >
                              <div className="font-medium truncate text-sm">{event.title}</div>
                              {event.location && (
                                <div className="opacity-75 text-xs truncate mt-1">{event.location}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
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
                // Get date info for styling
                const dateInfo = getTripDateInfo(date, tripStartDate, tripEndDate)
                const dayId = tripDay?.id || ''
                const event = dayId ? getEventForTimeSlot(dayId, timeSlot) : null
                const isClickable = tripDay && !event && dateInfo.isWithinTripDates
                const isInSelection = dayId ? isSlotInSelection(dayId, timeSlot) : false
                const isEventStart = event && event.startSlot === timeSlot
                const isOutsideRange = dateInfo.dateType === 'outside-range'
                const isPartOfEvent = event && !isEventStart
                
                return (
                  <div
                    key={`${format(date, 'yyyy-MM-dd')}-${timeSlot}`}
                    className={`border-r p-1 relative ${
                      isClickable 
                        ? 'cursor-pointer hover:bg-blue-50' 
                        : isOutsideRange
                        ? 'bg-gray-100 opacity-50 cursor-not-allowed'
                        : (isPartOfEvent || isEventStart)
                        ? '' // No grey background for any slots with events
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
                            
                            // Capture position immediately
                            const rect = e.currentTarget.getBoundingClientRect()
                            const position = { 
                              top: rect.bottom + window.scrollY + 5, 
                              left: rect.left + window.scrollX 
                            }
                            
                            // Set timer for single click action
                            const timer = setTimeout(() => {
                              // Show event details panel after delay
                              if (onEventSelect) {
                                onEventSelect(event, position)
                              }
                              setClickTimer(null)
                              setLastClickedEventId(null)
                            }, 300) // 300ms delay to wait for potential double-click
                            
                            setClickTimer(timer)
                            setLastClickedEventId(event.id)
                          }
                        }}
                        className={`absolute left-1 right-1 cursor-pointer hover:shadow-lg transition-all duration-200 rounded text-xs p-1 overflow-hidden ${
                          newEventIds?.has(event.id) ? 'event-grow-animation' : ''
                        } ${
                          deletingEventIds?.has(event.id) ? 'opacity-30 scale-95' : ''
                        } ${
                          selectedEventId === event.id ? 'ring-1 ring-teal-500' : ''
                        }`}
                        style={{
                          backgroundColor: event.color || EVENT_COLORS[0].color,
                          color: getEventColor(event.color || EVENT_COLORS[0].color).fontColor,
                          height: `${getTimeSlotRange(event.startSlot, event.endSlot || event.startSlot).length * 60 - 8}px`,
                          zIndex: selectedEventId === event.id ? 15 : 10,
                          top: '4px'
                        }}
                      >
                        <div className="font-medium line-clamp-2">{event.title}</div>
                        {event.location && (
                          <div className="opacity-75 text-xs line-clamp-1">{event.location}</div>
                        )}
                        {event.notes && (
                          <div className="opacity-75 text-xs mt-1 line-clamp-3">{event.notes}</div>
                        )}
                      </div>
                    ) : null}
                    <div className="h-full min-h-[52px]" />
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