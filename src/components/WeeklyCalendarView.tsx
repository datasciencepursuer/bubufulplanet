'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { format, eachDayOfInterval, addDays, subDays, parseISO, min, max, addWeeks, subWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachWeekOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays, ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Event, TripDay } from '@prisma/client'
import { EVENT_COLORS, getEventColor } from '@/lib/eventColors'
import { getTripDateInfo, getTripDateStyles, normalizeDate } from '@/lib/tripDayUtils'
import { TIME_SLOTS, formatTimeSlot, getTimeSlotRange, getNextTimeSlot } from '@/lib/timeSlotUtils'

interface WeeklyCalendarViewProps {
  tripStartDate: string
  tripEndDate: string
  tripName?: string
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
  onBack?: () => void
  onCreateEvent?: () => void
}

export default function WeeklyCalendarView({
  tripStartDate,
  tripEndDate,
  tripName,
  tripDays,
  events,
  selectedEventId,
  newEventIds,
  deletingEventIds,
  onTimeSlotClick,
  onTimeRangeSelect,
  onEventClick,
  onEventSelect,
  onDayHeaderClick,
  onBack,
  onCreateEvent
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

  // Current week end date
  const currentWeekEnd = useMemo(() => {
    return addDays(currentWeekStart, 6)
  }, [currentWeekStart])

  // Trip days within the current week
  const tripDaysInWeek = useMemo(() => {
    const weekDays = eachDayOfInterval({
      start: currentWeekStart,
      end: currentWeekEnd
    })
    
    return weekDays.map(date => {
      const dateStr = normalizeDate(date)
      const tripDay = tripDaysMap.get(dateStr)
      
      return { date, tripDay }
    })
  }, [currentWeekStart, currentWeekEnd, tripDaysMap])

  // Drag state
  const [dragState, setDragState] = useState<{
    startDayId: string
    startSlot: string
    currentSlot: string
  } | null>(null)

  // Click handling state
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null)
  const [lastClickedEventId, setLastClickedEventId] = useState<string | null>(null)
  
  // Ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Navigation functions
  const canGoToPrevious = useMemo(() => currentWeekStart > startDate, [currentWeekStart, startDate])
  const canGoToNext = useMemo(() => currentWeekEnd < endDate, [currentWeekEnd, endDate])

  const goToPreviousWeek = useCallback(() => {
    if (canGoToPrevious) {
      setCurrentWeekStart(prev => {
        const newStart = subWeeks(prev, 1)
        return max([newStart, startOfWeek(startDate, { weekStartsOn: 1 })])
      })
    }
  }, [canGoToPrevious, startDate])

  const goToNextWeek = useCallback(() => {
    if (canGoToNext) {
      setCurrentWeekStart(prev => {
        const newStart = addWeeks(prev, 1)
        return min([newStart, startOfWeek(endDate, { weekStartsOn: 1 })])
      })
    }
  }, [canGoToNext, endDate])

  // Event helper functions
  const getEventForTimeSlot = useCallback((dayId: string, timeSlot: string) => {
    return events.find(event => 
      event.dayId === dayId && 
      event.startSlot === timeSlot
    )
  }, [events])

  const getEventHeight = useCallback((event: Event) => {
    if (!event.endSlot || event.endSlot === '24:00') {
      return 52 // Single hour
    }
    
    const startIndex = TIME_SLOTS.indexOf(event.startSlot)
    const endIndex = TIME_SLOTS.indexOf(event.endSlot)
    
    if (startIndex === -1 || endIndex === -1) {
      return 52
    }
    
    const slotCount = Math.max(1, endIndex - startIndex)
    return slotCount * 60 - 8 // 60px per slot minus padding
  }, [])

  const getMobileEventHeight = useCallback((event: Event) => {
    if (!event.endSlot || event.endSlot === '24:00') {
      return 40 // Single hour (matches mobile time slot height)
    }
    
    const startIndex = TIME_SLOTS.indexOf(event.startSlot)
    const endIndex = TIME_SLOTS.indexOf(event.endSlot)
    
    if (startIndex === -1 || endIndex === -1) {
      return 40
    }
    
    const slotCount = Math.max(1, endIndex - startIndex)
    return slotCount * 40 + (slotCount - 1) * 1 // 40px per slot + 1px gap
  }, [])

  // Drag handling
  const handleDragStart = useCallback((e: React.MouseEvent, dayId: string, timeSlot: string) => {
    e.preventDefault()
    setDragState({
      startDayId: dayId,
      startSlot: timeSlot,
      currentSlot: timeSlot
    })
  }, [])

  const handleDragEnter = useCallback((dayId: string, timeSlot: string) => {
    if (dragState && dayId === dragState.startDayId) {
      setDragState(prev => prev ? { ...prev, currentSlot: timeSlot } : null)
    }
  }, [dragState])

  const handleDragEnd = useCallback(() => {
    if (!dragState) return
    
    const startSlotIndex = TIME_SLOTS.indexOf(dragState.startSlot)
    const endSlotIndex = TIME_SLOTS.indexOf(dragState.currentSlot)
    
    const startSlot = TIME_SLOTS[Math.min(startSlotIndex, endSlotIndex)]
    const endSlot = TIME_SLOTS[Math.max(startSlotIndex, endSlotIndex)]
    
    if (startSlot !== endSlot) {
      // Multi-hour selection
      const maxSlotIndex = Math.min(TIME_SLOTS.length - 1, Math.max(startSlotIndex, endSlotIndex) + 1)
      const adjustedEndSlot = maxSlotIndex < TIME_SLOTS.length ? TIME_SLOTS[maxSlotIndex] : '24:00'
      onTimeRangeSelect(dragState.startDayId, startSlot, adjustedEndSlot)
    } else {
      // Single slot click
      onTimeSlotClick(dragState.startDayId, startSlot, getNextTimeSlot(startSlot))
    }
    
    setDragState(null)
  }, [dragState, onTimeRangeSelect, onTimeSlotClick])

  const isSlotInSelection = useCallback((dayId: string, timeSlot: string) => {
    if (!dragState || dayId !== dragState.startDayId) return false
    
    const startIndex = TIME_SLOTS.indexOf(dragState.startSlot)
    const currentIndex = TIME_SLOTS.indexOf(dragState.currentSlot)
    const slotIndex = TIME_SLOTS.indexOf(timeSlot)
    
    const minIndex = Math.min(startIndex, currentIndex)
    const maxIndex = Math.max(startIndex, currentIndex)
    
    return slotIndex >= minIndex && slotIndex <= maxIndex
  }, [dragState])

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

  // Scroll to bottom on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  // Cleanup effects
  useEffect(() => {
    return () => {
      if (clickTimer) {
        clearTimeout(clickTimer)
      }
    }
  }, [clickTimer])

  return (
    <div className="flex h-screen bg-white fixed inset-0 z-50">
      {/* Left Sidebar with Mini Calendar - Hidden on mobile */}
      <div className="hidden md:flex w-80 bg-white border-r border-gray-200 flex-col">
        {/* Back Button and Trip Name */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            {onBack && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
                className="flex items-center gap-2 text-teal-600 border-teal-200 hover:bg-teal-50 hover:text-teal-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          {tripName && (
            <div className="mb-3">
              <h1 className="text-xl font-semibold text-gray-900 truncate">
                {tripName}
              </h1>
            </div>
          )}
          {onCreateEvent && (
            <Button
              onClick={onCreateEvent}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Event
            </Button>
          )}
        </div>

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
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            {onCreateEvent && (
              <Button
                onClick={onCreateEvent}
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create
              </Button>
            )}
          </div>
          {tripName && (
            <h1 className="text-lg font-semibold text-gray-900 truncate mb-2">
              {tripName}
            </h1>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek} disabled={!canGoToPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextWeek} disabled={!canGoToNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="text-sm font-medium text-gray-900">
              {format(currentWeekStart, 'MMM d')} - {format(currentWeekEnd, 'd, yyyy')}
            </h2>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex bg-white border-b border-gray-200 p-4 items-center justify-between">
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
            {/* Mobile Calendar Grid */}
            <div className="md:hidden flex-1 overflow-auto" ref={scrollContainerRef}>
              {/* Mobile Day Headers */}
              <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                {/* Empty space for time column */}
                <div className="w-14 flex-shrink-0"></div>
                {/* Day headers aligned with time slots */}
                <div className="flex-1 grid grid-cols-7 gap-px px-1">
                {tripDaysInWeek.map(({ date, tripDay }) => {
                  const dateInfo = getTripDateInfo(date, tripStartDate, tripEndDate)
                  const isToday = isSameDay(date, new Date())
                  
                  return (
                    <div
                      key={format(date, 'yyyy-MM-dd')}
                      className="p-2 text-center cursor-pointer hover:bg-gray-100 transition-colors rounded-sm"
                      onClick={() => {
                        if (onDayHeaderClick) {
                          onDayHeaderClick(format(date, 'yyyy-MM-dd'))
                        }
                      }}
                    >
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        {format(date, 'EEEEE')}
                      </div>
                      <div className={`text-lg font-normal ${
                        isToday 
                          ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto' 
                          : dateInfo.isWithinTripDates 
                            ? 'text-gray-900' 
                            : 'text-gray-400'
                      }`}>
                        {format(date, 'd')}
                      </div>
                      {tripDay?.destination && dateInfo.isWithinTripDates && (
                        <div className="text-xs text-teal-600 font-medium mt-1 truncate px-1">
                          {tripDay.destination}
                        </div>
                      )}
                    </div>
                  )
                })}
                </div>
              </div>
              
              {/* Mobile Time Slots */}
              <div className="space-y-px p-1">
                {TIME_SLOTS.map((timeSlot, index) => (
                  <div key={timeSlot} className="flex items-start min-h-[40px]">
                    {/* Time Label */}
                    <div className="w-14 flex-shrink-0 text-xs text-gray-500 py-2 pr-2 text-right">
                      {formatTimeSlot(timeSlot)}
                    </div>
                    
                    {/* Day Columns */}
                    <div className="flex-1 grid grid-cols-7 gap-px">
                      {tripDaysInWeek.map(({ date, tripDay }) => {
                        const dateInfo = getTripDateInfo(date, tripStartDate, tripEndDate)
                        const dayId = tripDay?.id || ''
                        const event = dayId ? getEventForTimeSlot(dayId, timeSlot) : null
                        const isClickable = tripDay && !event && dateInfo.isWithinTripDates
                        const isEventStart = event && event.startSlot === timeSlot
                        const isOutsideRange = dateInfo.dateType === 'outside-range'
                        
                        return (
                          <div
                            key={`${format(date, 'yyyy-MM-dd')}-${timeSlot}`}
                            className={`h-10 bg-white border border-gray-200 relative ${
                              isClickable 
                                ? 'hover:bg-blue-50 cursor-pointer active:bg-blue-100' 
                                : isOutsideRange 
                                  ? 'bg-gray-50 border-gray-100' 
                                  : ''
                            }`}
                            onClick={isClickable ? () => onTimeSlotClick(dayId, timeSlot, getNextTimeSlot(timeSlot)) : undefined}
                          >
                            {isEventStart && (
                              <div
                                key={event.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onEventClick(event)
                                }}
                                className="absolute left-0.5 right-0.5 cursor-pointer text-xs px-2 py-1 overflow-hidden rounded-sm shadow-sm"
                                style={{
                                  backgroundColor: getEventColor(event.color).background,
                                  borderLeft: `3px solid ${getEventColor(event.color).border}`,
                                  color: getEventColor(event.color).text,
                                  height: `${getMobileEventHeight(event)}px`,
                                  top: '2px',
                                  zIndex: 10
                                }}
                              >
                                <div className="font-medium truncate text-xs leading-tight">{event.title}</div>
                                {event.location && (
                                  <div className="text-xs opacity-75 truncate leading-tight">{event.location}</div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Time Slots Grid */}
            <div className="hidden md:block flex-1 overflow-auto" ref={scrollContainerRef}>
              {/* Day Headers - inside scrollable container */}
              <div className="grid border-b border-gray-200 bg-gray-50 sticky top-0 z-10" style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}>
                <div className="p-3 text-xs font-medium text-gray-500 border-r border-gray-200">
                  {/* Time column header - empty to align with time slots */}
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
                      {tripDay?.destination && dateInfo.isWithinTripDates && (
                        <div className="text-xs text-teal-600 font-medium mt-2 truncate px-1">
                          {tripDay.destination}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="grid" style={{ minHeight: `${TIME_SLOTS.length * 60}px`, gridTemplateColumns: '80px repeat(7, 1fr)' }}>
                {/* Time Column */}
                <div className="border-r border-gray-200 bg-gray-50">
                  {TIME_SLOTS.map((timeSlot, index) => (
                    <div 
                      key={timeSlot} 
                      className="h-[60px] border-b border-gray-100 flex items-start justify-end pr-3 pt-2"
                    >
                      <span className="text-xs text-gray-500 -mt-2">
                        {formatTimeSlot(timeSlot)}
                      </span>
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
}