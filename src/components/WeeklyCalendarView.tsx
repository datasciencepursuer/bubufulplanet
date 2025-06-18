'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { format, eachDayOfInterval, addDays, subDays, isSameDay, parseISO, min, max, addWeeks, subWeeks, differenceInDays } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, ChevronsLeft, ChevronsRight, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Event, TripDay } from '@prisma/client'
import { EVENT_COLORS, getEventColor } from '@/lib/eventColors'
import { getTripDateInfo, getTripDateStyles, normalizeDate } from '@/lib/tripDayUtils'
import { extractTimeFromDateTime, calculateDefaultEndTime } from '@/lib/dateTimeUtils'

interface WeeklyCalendarViewProps {
  tripStartDate: string
  tripEndDate: string
  tripDays: TripDay[]
  events: Event[]
  selectedEventId?: string | null
  newEventIds?: Set<string>
  onTimeSlotClick: (dayId: string, time: string) => void
  onTimeRangeSelect: (dayId: string, startTime: string, endTime: string, endDate?: string) => void
  onEventClick: (event: Event) => void
  onEventSelect?: (event: Event, position: { top: number; left: number }) => void
  onDayHeaderClick?: (date: string) => void
}

const TIME_SLOTS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00',
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', 
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
]

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
  
  // Calculate trip range with 1-day buffer
  const tripRangeStart = subDays(startDate, 1)
  const tripRangeEnd = addDays(endDate, 1)
  
  // Current view shows 7 days starting from this date
  const [currentStartDate, setCurrentStartDate] = useState(() => {
    // Always start from the beginning of the trip range (trip start - 1 day)
    // This provides a full week view starting one day before the trip
    return tripRangeStart
  })
  const [isAnimating, setIsAnimating] = useState(false)

  // Pre-calculate all possible date ranges for instant navigation
  const allPossibleDates = useMemo(() => {
    return eachDayOfInterval({ start: tripRangeStart, end: tripRangeEnd })
  }, [tripRangeStart, tripRangeEnd])

  // Pre-render trip days map for quick lookup
  const tripDaysMap = useMemo(() => {
    const map = new Map()
    tripDays.forEach(td => {
      // Ensure date is formatted consistently as yyyy-MM-dd string
      const dateStr = td.date instanceof Date 
        ? format(td.date, 'yyyy-MM-dd')
        : format(new Date(td.date), 'yyyy-MM-dd')
      map.set(dateStr, td)
    })
    return map
  }, [tripDays])

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

  // Show 7 days starting from currentStartDate, but constrain to trip range
  const viewEndDate = addDays(currentStartDate, 6)
  const constrainedEndDate = min([viewEndDate, tripRangeEnd])
  const weekDays = eachDayOfInterval({ start: currentStartDate, end: constrainedEndDate })

  // Calculate navigation boundaries more precisely  
  // The last valid start position is when we can still move forward without going past tripRangeEnd
  // We should be able to scroll until tripRangeEnd is the last day in view (position 7)
  const maxPossibleStartDate = subDays(tripRangeEnd, 6) // If we start here, tripRangeEnd is day 7
  
  const canGoToPrevious = currentStartDate > tripRangeStart
  const canGoToNext = currentStartDate < maxPossibleStartDate

  const tripDaysInWeek = useMemo(() => {
    return weekDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const tripDay = tripDaysMap.get(dateStr)
      return { date: day, tripDay }
    })
  }, [weekDays, tripDaysMap])

  const eventsForWeek = useMemo(() => {
    const eventsByDay: Record<string, Event[]> = {}
    
    tripDaysInWeek.forEach(({ tripDay, date }) => {
      if (tripDay) {
        eventsByDay[tripDay.id] = []
        
        // Get all events that appear on this specific date
        events.forEach(event => {
          const eventStartDate = new Date(event.startDate)
          const eventEndDate = event.endDate ? new Date(event.endDate) : eventStartDate
          const currentDate = date
          
          // Check if the current date falls within the event's date range
          if (currentDate >= eventStartDate && currentDate <= eventEndDate) {
            eventsByDay[tripDay.id].push(event)
          }
        })
        
        // Sort events by start time
        eventsByDay[tripDay.id].sort((a, b) => {
          const aTime = extractTimeFromDateTime(new Date(a.startTime))
          const bTime = extractTimeFromDateTime(new Date(b.startTime))
          return aTime.localeCompare(bTime)
        })
      }
    })
    
    return eventsByDay
  }, [tripDaysInWeek, events])

  const goToPreviousDay = useCallback(() => {
    const newDate = subDays(currentStartDate, 1)
    if (newDate >= tripRangeStart) {
      setCurrentStartDate(newDate)
    }
  }, [currentStartDate, tripRangeStart])

  const goToNextDay = useCallback(() => {
    const newDate = addDays(currentStartDate, 1)
    if (newDate <= maxPossibleStartDate) {
      setCurrentStartDate(newDate)
    }
  }, [currentStartDate, maxPossibleStartDate])

  const goToPreviousWeek = useCallback(() => {
    const newDate = subWeeks(currentStartDate, 1)
    const constrainedDate = max([newDate, tripRangeStart])
    setCurrentStartDate(constrainedDate)
  }, [currentStartDate, tripRangeStart])

  const goToNextWeek = useCallback(() => {
    const newDate = addWeeks(currentStartDate, 1)
    const constrainedDate = min([newDate, maxPossibleStartDate])
    setCurrentStartDate(constrainedDate)
  }, [currentStartDate, maxPossibleStartDate])

  const goToToday = useCallback(() => {
    const today = new Date()
    
    // Check if today is within the trip dates
    if (today < startDate || today > endDate) {
      return // Today is not within the trip
    }
    
    // Find the Sunday of the current week
    const dayOfWeek = today.getDay()
    const weekStart = subDays(today, dayOfWeek)
    
    // Ensure the week start is within trip bounds
    const targetDate = weekStart < tripRangeStart ? tripRangeStart : weekStart
    
    if (targetDate.getTime() !== currentStartDate.getTime()) {
      setCurrentStartDate(targetDate)
    }
  }, [startDate, endDate, tripRangeStart, currentStartDate])

  const canGoToPreviousWeek = currentStartDate > tripRangeStart
  const canGoToNextWeek = currentStartDate < maxPossibleStartDate
  
  // Check if today is within the trip and if we can show today button
  const isTodayInTrip = useMemo(() => {
    const today = new Date()
    return today >= startDate && today <= endDate
  }, [startDate, endDate])

  // Helper function to convert Date to time string
  const dateToTimeString = (date: Date): string => {
    return extractTimeFromDateTime(date)
  }

  const getEventForTimeSlot = (dayId: string, timeSlot: string): Event | null => {
    const dayEvents = eventsForWeek[dayId] || []
    const tripDay = tripDays.find(td => td.id === dayId)
    if (!tripDay) return null
    
    const currentDate = new Date(tripDay.date)
    
    return dayEvents.find(event => {
      const eventStartDate = new Date(event.startDate)
      const eventEndDate = event.endDate ? new Date(event.endDate) : eventStartDate
      
      let effectiveStartTime: string
      let effectiveEndTime: string
      
      // Determine the effective start and end times for this specific day
      if (currentDate.getTime() === eventStartDate.getTime() && currentDate.getTime() === eventEndDate.getTime()) {
        // Single day event
        effectiveStartTime = dateToTimeString(event.startTime)
        effectiveEndTime = event.endTime ? dateToTimeString(event.endTime) : calculateDefaultEndTime(effectiveStartTime)
      } else if (currentDate.getTime() === eventStartDate.getTime()) {
        // First day of multi-day event
        effectiveStartTime = dateToTimeString(event.startTime)
        effectiveEndTime = "23:59"
      } else if (currentDate.getTime() === eventEndDate.getTime()) {
        // Last day of multi-day event
        effectiveStartTime = "00:00"
        effectiveEndTime = event.endTime ? dateToTimeString(event.endTime) : "23:59"
      } else {
        // Middle day of multi-day event
        effectiveStartTime = "00:00"
        effectiveEndTime = "23:59"
      }
      
      const slotMinutes = parseInt(timeSlot.split(':')[0]) * 60 + parseInt(timeSlot.split(':')[1])
      const startMinutes = parseInt(effectiveStartTime.split(':')[0]) * 60 + parseInt(effectiveStartTime.split(':')[1])
      const endMinutes = parseInt(effectiveEndTime.split(':')[0]) * 60 + parseInt(effectiveEndTime.split(':')[1])
      
      return slotMinutes >= startMinutes && slotMinutes < endMinutes
    }) || null
  }
  

  const getEventSpanInfo = (dayId: string, timeSlot: string): { event: Event | null, isFirst: boolean, isLast: boolean, totalSlots: number, durationMinutes: number } => {
    const event = getEventForTimeSlot(dayId, timeSlot)
    if (!event) return { event: null, isFirst: false, isLast: false, totalSlots: 0, durationMinutes: 0 }

    const eventStartTime = dateToTimeString(event.startTime)
    const eventEndTime = event.endTime ? dateToTimeString(event.endTime) : calculateDefaultEndTime(eventStartTime)
    
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

  const isWithinTripDates = (date: Date): boolean => {
    return date >= startDate && date <= endDate
  }

  const getTimeSlotIndex = (timeSlot: string): number => {
    return TIME_SLOTS.indexOf(timeSlot)
  }

  const isSlotInSelection = (dayId: string, timeSlot: string): boolean => {
    if (!dragState.isActive || !dragState.startDayId || !dragState.currentDayId) return false
    
    const startDayIndex = tripDaysInWeek.findIndex(d => d.tripDay?.id === dragState.startDayId)
    const currentDayIndex = tripDaysInWeek.findIndex(d => d.tripDay?.id === dragState.currentDayId)
    const checkDayIndex = tripDaysInWeek.findIndex(d => d.tripDay?.id === dayId)
    
    if (startDayIndex === -1 || currentDayIndex === -1 || checkDayIndex === -1) return false
    
    const minDayIndex = Math.min(startDayIndex, currentDayIndex)
    const maxDayIndex = Math.max(startDayIndex, currentDayIndex)
    
    // Check if this day is within the selection range
    if (checkDayIndex < minDayIndex || checkDayIndex > maxDayIndex) return false
    
    const startTimeIndex = getTimeSlotIndex(dragState.startTimeSlot!)
    const currentTimeIndex = getTimeSlotIndex(dragState.currentTimeSlot!)
    const slotIndex = getTimeSlotIndex(timeSlot)
    
    // Special case: single day selection (same start and end day)
    if (startDayIndex === currentDayIndex && checkDayIndex === startDayIndex) {
      const minTime = Math.min(startTimeIndex, currentTimeIndex)
      const maxTime = Math.max(startTimeIndex, currentTimeIndex)
      return slotIndex >= minTime && slotIndex <= maxTime
    }
    
    // Multi-day selection
    // For the first day in the selection
    if (checkDayIndex === minDayIndex) {
      // If dragging forward (start day is first)
      if (startDayIndex <= currentDayIndex) {
        return slotIndex >= startTimeIndex
      } else {
        // If dragging backward (current day is first)
        return slotIndex >= currentTimeIndex
      }
    }
    // For the last day in the selection
    else if (checkDayIndex === maxDayIndex) {
      // If dragging forward (current day is last)
      if (startDayIndex <= currentDayIndex) {
        return slotIndex <= currentTimeIndex
      } else {
        // If dragging backward (start day is last)
        return slotIndex <= startTimeIndex
      }
    }
    // For days in between
    else {
      return true
    }
  }

  const handleMouseDown = (dayId: string, timeSlot: string, hasEvent: boolean) => {
    if (hasEvent) return // Don't start drag on existing events
    
    setDragState({
      isActive: true,
      startDayId: dayId,
      startTimeSlot: timeSlot,
      currentDayId: dayId,
      currentTimeSlot: timeSlot
    })
  }

  const handleMouseEnter = (dayId: string, timeSlot: string) => {
    if (dragState.isActive) {
      setDragState(prev => ({
        ...prev,
        currentDayId: dayId,
        currentTimeSlot: timeSlot
      }))
    }
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

  const handleMouseUp = useCallback(() => {
    if (dragState.isActive && dragState.startDayId && dragState.startTimeSlot && dragState.currentDayId && dragState.currentTimeSlot) {
      const startDayIndex = tripDaysInWeek.findIndex(d => d.tripDay?.id === dragState.startDayId)
      const currentDayIndex = tripDaysInWeek.findIndex(d => d.tripDay?.id === dragState.currentDayId)
      
      if (startDayIndex === -1 || currentDayIndex === -1) {
        setDragState({
          isActive: false,
          startDayId: null,
          startTimeSlot: null,
          currentDayId: null,
          currentTimeSlot: null
        })
        return
      }
      
      // Determine actual start and end based on drag direction
      let actualStartDayId: string
      let actualStartTime: string
      let actualEndDayId: string
      let actualEndTime: string
      let actualStartDate: string
      let actualEndDate: string
      
      if (startDayIndex <= currentDayIndex) {
        // Forward drag
        actualStartDayId = dragState.startDayId
        actualStartTime = dragState.startTimeSlot
        actualEndDayId = dragState.currentDayId
        actualEndTime = TIME_SLOTS[Math.min(getTimeSlotIndex(dragState.currentTimeSlot) + 1, TIME_SLOTS.length - 1)]
        actualStartDate = tripDaysInWeek[startDayIndex].tripDay!.date
        actualEndDate = tripDaysInWeek[currentDayIndex].tripDay!.date
      } else {
        // Backward drag
        actualStartDayId = dragState.currentDayId
        actualStartTime = dragState.currentTimeSlot
        actualEndDayId = dragState.startDayId
        actualEndTime = TIME_SLOTS[Math.min(getTimeSlotIndex(dragState.startTimeSlot) + 1, TIME_SLOTS.length - 1)]
        actualStartDate = tripDaysInWeek[currentDayIndex].tripDay!.date
        actualEndDate = tripDaysInWeek[startDayIndex].tripDay!.date
      }
      
      // Call the parent handler with cross-day event information (normalize dates)
      if (onTimeRangeSelect) {
        onTimeRangeSelect(actualStartDayId, actualStartTime, actualEndTime, normalizeDate(actualEndDate))
      }
    }
    
    setDragState({
      isActive: false,
      startDayId: null,
      startTimeSlot: null,
      currentDayId: null,
      currentTimeSlot: null
    })
  }, [dragState, onTimeRangeSelect, tripDaysInWeek])

  // Add global mouseup listener to handle drag end
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragState.isActive) {
        handleMouseUp()
      }
    }

    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [dragState.isActive, handleMouseUp])

  // Add keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return // Don't interfere with input fields
      
      if (e.key === 'ArrowLeft' && canGoToPrevious) {
        e.preventDefault()
        if (e.shiftKey) {
          goToPreviousWeek()
        } else {
          goToPreviousDay()
        }
      } else if (e.key === 'ArrowRight' && canGoToNext) {
        e.preventDefault()
        if (e.shiftKey) {
          goToNextWeek()
        } else {
          goToNextDay()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [canGoToPrevious, canGoToNext, goToPreviousDay, goToNextDay, goToPreviousWeek, goToNextWeek])

  // Cleanup click timeout on unmount
  useEffect(() => {
    return () => {
      if (clickState.clickTimeout) {
        clearTimeout(clickState.clickTimeout)
      }
    }
  }, [clickState.clickTimeout])

  // Add touch/swipe support
  useEffect(() => {
    let touchStartX = 0
    let touchStartY = 0
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
    }
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (!e.changedTouches[0]) return
      
      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      const deltaX = touchStartX - touchEndX
      const deltaY = touchStartY - touchEndY
      
      // Only trigger if horizontal swipe is dominant and significant
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0 && canGoToNext) {
          // Swipe left - go to next day
          goToNextDay()
        } else if (deltaX < 0 && canGoToPrevious) {
          // Swipe right - go to previous day
          goToPreviousDay()
        }
      }
    }
    
    const calendarElement = document.querySelector('[data-calendar-container]')
    if (calendarElement) {
      calendarElement.addEventListener('touchstart', handleTouchStart as EventListener, { passive: true })
      calendarElement.addEventListener('touchend', handleTouchEnd as EventListener, { passive: true })
      
      return () => {
        const currentElement = document.querySelector('[data-calendar-container]')
        if (currentElement) {
          currentElement.removeEventListener('touchstart', handleTouchStart as EventListener)
          currentElement.removeEventListener('touchend', handleTouchEnd as EventListener)
        }
      }
    }
  }, [canGoToPrevious, canGoToNext, goToPreviousDay, goToNextDay])

  return (
    <div className="bg-white rounded-lg border" data-calendar-container>
      {/* Day Navigation */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToPreviousWeek}
            disabled={!canGoToPreviousWeek}
            title="Previous Week (Shift + Left Arrow)"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToPreviousDay}
            disabled={!canGoToPrevious}
            title="Previous Day (Left Arrow)"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous Day
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            {weekDays.length === 7 
              ? `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}`
              : weekDays.length === 1
              ? format(weekDays[0], 'MMM d, yyyy')
              : `${format(weekDays[0], 'MMM d')} - ${format(weekDays[weekDays.length - 1], 'MMM d, yyyy')}`
            }
          </h2>
          {isTodayInTrip && (
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="ml-2"
              title="Go to current week"
            >
              <CalendarDays className="h-4 w-4 mr-1" />
              Today
            </Button>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToNextDay}
            disabled={!canGoToNext}
            title="Next Day (Right Arrow)"
          >
            Next Day
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToNextWeek}
            disabled={!canGoToNextWeek}
            title="Next Week (Shift + Right Arrow)"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Day Headers */}
          <div className="grid border-b bg-gray-50" style={{ gridTemplateColumns: `120px repeat(${weekDays.length}, 1fr)` }}>
            <div className="p-3 text-sm font-medium text-gray-500">Time</div>
            {tripDaysInWeek.map(({ date, tripDay }) => (
              <div 
                key={date.toISOString()} 
                className={`p-3 text-center ${
                  tripDay && onDayHeaderClick 
                    ? 'cursor-pointer hover:bg-blue-50 transition-colors' 
                    : ''
                }`}
                onClick={() => {
                  if (tripDay && onDayHeaderClick) {
                    // Ensure consistent date format for onDayHeaderClick
                    const dateStr = tripDay.date instanceof Date 
                      ? format(tripDay.date, 'yyyy-MM-dd')
                      : format(new Date(tripDay.date), 'yyyy-MM-dd')
                    onDayHeaderClick(dateStr)
                  }
                }}
              >
                <div className="text-sm font-medium">
                  {format(date, 'EEE')}
                </div>
                {(() => {
                  const dateInfo = getTripDateInfo(date, tripStartDate, tripEndDate)
                  const styles = getTripDateStyles(dateInfo)
                  
                  return (
                    <>
                      <div className={`text-lg ${styles.dateNumber}`}>
                        {format(date, 'd')}
                      </div>
                      {styles.dayLabel.show && (
                        <div className={styles.dayLabel.className}>
                          {styles.dayLabel.text}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            ))}
          </div>

          {/* Time Slots */}
          {TIME_SLOTS.map(timeSlot => (
            <div key={timeSlot} className="grid border-b hover:bg-gray-50" style={{ gridTemplateColumns: `120px repeat(${weekDays.length}, 1fr)` }}>
              <div className="p-3 text-sm text-gray-500 border-r">
                {format(new Date(`2000-01-01T${timeSlot}`), 'h:mm a')}
              </div>
              
              {tripDaysInWeek.map(({ date, tripDay }) => {
                const eventSpan = tripDay ? getEventSpanInfo(tripDay.id, timeSlot) : { event: null, isFirst: false, isLast: false, totalSlots: 0, durationMinutes: 0 }
                const { event, isFirst, isLast, totalSlots, durationMinutes } = eventSpan
                const isClickable = tripDay && isWithinTripDates(date)
                const isInSelection = tripDay ? isSlotInSelection(tripDay.id, timeSlot) : false
                
                return (
                  <div
                    key={`${date.toISOString()}-${timeSlot}`}
                    className={`p-2 border-r min-h-[60px] relative select-none ${
                      isClickable ? 'cursor-pointer hover:bg-blue-50' : 'bg-gray-100'
                    } ${isInSelection ? 'bg-blue-200 hover:bg-blue-300' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      if (isClickable && tripDay && !event) {
                        handleMouseDown(tripDay.id, timeSlot, false)
                      }
                    }}
                    onMouseEnter={() => {
                      if (isClickable && tripDay && !event) {
                        handleMouseEnter(tripDay.id, timeSlot)
                      }
                    }}
                    onMouseUp={handleMouseUp}
                    onClick={(e) => {
                      if (!isClickable || dragState.isActive) return
                      
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
                        const eventStartTime = dateToTimeString(event.startTime)
                        const eventStartMinutes = parseInt(eventStartTime.split(':')[1])
                        const eventEndTime = event.endTime ? dateToTimeString(event.endTime) : eventStartTime
                        const eventEndHour = parseInt(eventEndTime.split(':')[0])
                        const eventEndMinutes = parseInt(eventEndTime.split(':')[1])
                        const currentHour = parseInt(timeSlot.split(':')[0])
                        
                        // Check if event occupies the entire hour slot
                        const eventStartsThisHour = parseInt(eventStartTime.split(':')[0]) === currentHour
                        const eventEndsAfterThisHour = eventEndHour > currentHour || (eventEndHour === currentHour && eventEndMinutes === 0 && eventEndHour > parseInt(eventStartTime.split(':')[0]))
                        
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
                      
                      console.log('WeeklyCalendarView: Clicking time slot', { 
                        tripDayId: tripDay.id, 
                        clickTime, 
                        date: date.toISOString(),
                        tripDay 
                      })
                      onTimeSlotClick(tripDay.id, clickTime)
                    }}
                  >
                    {event && isFirst ? (
                      <div
                        onClick={(e) => handleEventClick(event, e)}
                        data-event-id={event.id}
                        className={`text-xs cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 absolute left-2 right-2 ${
                          durationMinutes <= 60 ? 'rounded' : 'rounded-t'
                        } ${newEventIds?.has(event.id) ? 'event-grow-animation' : ''} ${
                          selectedEventId === event.id ? 'ring-2 ring-teal-500 ring-offset-1' : ''
                        }`}
                        style={{
                          backgroundColor: event.color || EVENT_COLORS[0].color,
                          color: getEventColor(event.color || EVENT_COLORS[0].color).fontColor,
                          height: `${(durationMinutes / 60) * 60 - 4}px`,
                          top: `${(parseInt(dateToTimeString(event.startTime).split(':')[1]) / 60) * 60}px`,
                          zIndex: selectedEventId === event.id ? 15 : 10,
                          padding: '8px'
                        }}
                      >
                        {durationMinutes <= 30 ? (
                          // Ultra-compact view for 30-minute events - title only with tooltip including notes
                          <div className="flex items-center h-full">
                            <div className="font-medium text-left leading-tight text-xs truncate" title={`${event.title}${event.location ? ` • ${event.location}` : ''}${event.notes ? ` • ${event.notes}` : ''} • ${format(new Date(`2000-01-01T${dateToTimeString(event.startTime)}`), 'h:mm a')}${event.endTime ? ` - ${format(new Date(`2000-01-01T${dateToTimeString(event.endTime)}`), 'h:mm a')}` : ''}`}>
                              {event.title}
                            </div>
                          </div>
                        ) : durationMinutes <= 60 ? (
                          // Compact view for 1-hour events - title, time, and notes if available
                          <div className="flex flex-col justify-center h-full gap-1">
                            <div className="font-medium text-left truncate text-sm">{event.title}</div>
                            <div className="text-xs opacity-75 text-left truncate">
                              {format(new Date(`2000-01-01T${dateToTimeString(event.startTime)}`), 'h:mm a')}
                              {event.endTime && ` - ${format(new Date(`2000-01-01T${dateToTimeString(event.endTime)}`), 'h:mm a')}`}
                            </div>
                            {event.notes && (
                              <div className="text-xs text-left opacity-75 truncate italic">{event.notes}</div>
                            )}
                          </div>
                        ) : (
                          // Full view for longer events - title, location, notes, and time
                          <div className="flex flex-col justify-between h-full">
                            <div>
                              <div className="font-medium text-left truncate">{event.title}</div>
                              {event.location && (
                                <div className="text-left truncate opacity-90 mt-1">{event.location}</div>
                              )}
                              {event.notes && (
                                <div className="text-sm text-left opacity-75 mt-1 line-clamp-2 italic">{event.notes}</div>
                              )}
                            </div>
                            <div className="text-xs opacity-75 text-left">
                              {format(new Date(`2000-01-01T${dateToTimeString(event.startTime)}`), 'h:mm a')}
                              {event.endTime && ` - ${format(new Date(`2000-01-01T${dateToTimeString(event.endTime)}`), 'h:mm a')}`}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : event && !isFirst ? (
                      // Empty div for non-first slots of multi-slot events to maintain layout
                      <div className="h-full" />
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 border-t bg-gray-50 text-sm text-gray-600">
        <div className="flex items-center space-x-4 flex-wrap">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-700 border rounded"></div>
            <span>Trip Days</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-amber-500 border rounded"></div>
            <span>Buffer Days</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-100 border rounded"></div>
            <span>Outside Range</span>
          </div>
          <span className="ml-4">Navigate: Day buttons/Arrow keys, Week buttons/Shift+Arrow keys, or swipe. Click empty time slots to add events, drag to select ranges.</span>
        </div>
      </div>
    </div>
  )
}