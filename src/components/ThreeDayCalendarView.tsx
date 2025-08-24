'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { format, eachDayOfInterval, addDays, subDays, parseISO, isSameDay, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight, ArrowLeft, Plus, MoreVertical, DollarSign, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Event, TripDay } from '@prisma/client'
import { EVENT_COLORS, getEventColor } from '@/lib/eventColors'
import { getTripDateInfo, normalizeDate } from '@/lib/tripDayUtils'
import { TIME_SLOTS, formatTimeSlot, getNextTimeSlot } from '@/lib/timeSlotUtils'

interface ThreeDayCalendarViewProps {
  tripStartDate: string
  tripEndDate: string
  tripName?: string
  tripDays: TripDay[]
  events: Event[]
  selectedEventId?: string | null
  newEventIds?: Set<string>
  deletingEventIds?: Set<string>
  onTimeSlotClick: (dayId: string, startSlot: string, endSlot: string) => void
  onEventClick: (event: Event) => void
  onDayHeaderClick?: (date: string) => void
  onBack?: () => void
  onCreateEvent?: () => void
  onAddExpense?: () => void
  onShowPointsOfInterest?: () => void
  initialDate?: string
}

export default function ThreeDayCalendarView({
  tripStartDate,
  tripEndDate,
  tripName,
  tripDays,
  events,
  selectedEventId,
  newEventIds,
  deletingEventIds,
  onTimeSlotClick,
  onEventClick,
  onDayHeaderClick,
  onBack,
  onCreateEvent,
  onAddExpense,
  onShowPointsOfInterest,
  initialDate
}: ThreeDayCalendarViewProps) {
  const startDate = parseISO(tripStartDate)
  const endDate = parseISO(tripEndDate)
  
  // Calculate initial center date (middle of the 3-day view)
  const getInitialCenterDate = () => {
    if (initialDate) {
      return parseISO(initialDate)
    }
    // Default to today if within trip range, otherwise trip start
    const today = new Date()
    if (today >= startDate && today <= endDate) {
      return today
    }
    return startDate
  }

  const [centerDate, setCenterDate] = useState(getInitialCenterDate)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  
  // Calculate the 3-day window
  const threeDayWindow = useMemo(() => {
    const start = subDays(centerDate, 1) // Day before center
    const end = addDays(centerDate, 1)   // Day after center
    
    return eachDayOfInterval({ start, end })
  }, [centerDate])

  // Get trip days for the 3-day window
  const tripDaysInWindow = useMemo(() => {
    return threeDayWindow.map(date => {
      const dateStr = normalizeDate(date)
      const tripDay = tripDays.find(td => normalizeDate(td.date) === dateStr)
      return {
        date,
        tripDay
      }
    })
  }, [threeDayWindow, tripDays])

  // Navigation functions
  const canGoToPrevious = useMemo(() => 
    subDays(centerDate, 1) >= startDate
  , [centerDate, startDate])

  const canGoToNext = useMemo(() => 
    addDays(centerDate, 1) <= endDate
  , [centerDate, endDate])

  const goToPreviousDay = useCallback(() => {
    if (canGoToPrevious) {
      setCenterDate(prev => subDays(prev, 1))
    }
  }, [canGoToPrevious])

  const goToNextDay = useCallback(() => {
    if (canGoToNext) {
      setCenterDate(prev => addDays(prev, 1))
    }
  }, [canGoToNext])

  const goToToday = useCallback(() => {
    const today = new Date()
    if (today >= startDate && today <= endDate) {
      setCenterDate(today)
    } else {
      setCenterDate(startDate)
    }
  }, [startDate, endDate])

  // Event helper functions
  const getEventForTimeSlot = useCallback((dayId: string, timeSlot: string) => {
    return events.find(event => 
      event.dayId === dayId && 
      event.startSlot === timeSlot
    )
  }, [events])

  const getMobileEventHeight = useCallback((event: Event) => {
    if (!event.endSlot || event.endSlot === '24:00') {
      return 44 // Single hour (slightly larger than weekly view)
    }
    
    const startIndex = TIME_SLOTS.indexOf(event.startSlot)
    const endIndex = TIME_SLOTS.indexOf(event.endSlot)
    
    if (startIndex === -1 || endIndex === -1) {
      return 44
    }
    
    const slotCount = Math.max(1, endIndex - startIndex)
    return slotCount * 44 + (slotCount - 1) * 2 // 44px per slot + 2px gap
  }, [])

  // Ref for scrolling to bottom
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on mount (show evening hours)
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  return (
    <div className="relative">
      <div className="flex h-screen bg-white fixed inset-0 z-50 md:hidden">
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
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
              
              <h1 className="text-lg font-bold bg-gradient-to-r from-teal-800 to-teal-600 bg-clip-text text-transparent flex-1 text-center truncate">
                {tripName || 'Trip'}
              </h1>
              
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-2 text-gray-600 hover:text-gray-900"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
                
                {isMenuOpen && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsMenuOpen(false)}
                    />
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      {onAddExpense && (
                        <button
                          onClick={() => {
                            onAddExpense()
                            setIsMenuOpen(false)
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100"
                        >
                          <DollarSign className="h-4 w-4" />
                          Add Expense
                        </button>
                      )}
                      {onShowPointsOfInterest && (
                        <button
                          onClick={() => {
                            onShowPointsOfInterest()
                            setIsMenuOpen(false)
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                        >
                          <Map className="h-4 w-4" />
                          Points of Interest
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={goToPreviousDay} 
                  disabled={!canGoToPrevious}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={goToNextDay} 
                  disabled={!canGoToNext}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="text-center">
                <h2 className="text-sm font-medium text-gray-900">
                  {format(threeDayWindow[0], 'MMM d')} - {format(threeDayWindow[2], 'd, yyyy')}
                </h2>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="text-teal-600 border-teal-200 hover:bg-teal-50 text-xs px-2"
              >
                Today
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
                {/* Day Headers */}
                <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                  {/* Time column spacer */}
                  <div className="w-16 flex-shrink-0"></div>
                  {/* Day headers */}
                  <div className="flex-1 grid grid-cols-3 gap-px px-1">
                    {tripDaysInWindow.map(({ date, tripDay }) => {
                      const dateInfo = getTripDateInfo(date, tripStartDate, tripEndDate)
                      const isToday = isSameDay(date, new Date())
                      
                      return (
                        <div
                          key={format(date, 'yyyy-MM-dd')}
                          className="p-3 text-center cursor-pointer hover:bg-gray-100 transition-colors rounded-sm"
                          onClick={() => {
                            if (onDayHeaderClick) {
                              onDayHeaderClick(format(date, 'yyyy-MM-dd'))
                            }
                          }}
                        >
                          <div className="text-xs font-medium text-gray-500 mb-1">
                            {format(date, 'EEE')}
                          </div>
                          <div className={`text-xl font-normal ${
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
                </div>
                
                {/* Time Slots */}
                <div className="space-y-px p-1">
                  {TIME_SLOTS.map((timeSlot, index) => (
                    <div key={timeSlot} className="flex items-start min-h-[44px]">
                      {/* Time Label */}
                      <div className="w-16 flex-shrink-0 text-xs text-gray-500 py-2 pr-2 text-right">
                        {formatTimeSlot(timeSlot)}
                      </div>
                      
                      {/* Day Columns */}
                      <div className="flex-1 grid grid-cols-3 gap-px">
                        {tripDaysInWindow.map(({ date, tripDay }) => {
                          const dateInfo = getTripDateInfo(date, tripStartDate, tripEndDate)
                          const dayId = tripDay?.id || ''
                          const event = dayId ? getEventForTimeSlot(dayId, timeSlot) : null
                          const isClickable = tripDay && !event && dateInfo.isWithinTripDates
                          const isEventStart = event && event.startSlot === timeSlot
                          const isOutsideRange = dateInfo.dateType === 'outside-range'
                          
                          return (
                            <div
                              key={`${format(date, 'yyyy-MM-dd')}-${timeSlot}`}
                              className={`h-11 bg-white border border-gray-200 relative ${
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
                                  className={`absolute left-0.5 right-0.5 cursor-pointer text-xs px-2 py-1 overflow-hidden rounded-sm shadow-sm ${
                                    newEventIds?.has(event.id) ? 'event-grow-animation' : ''
                                  } ${
                                    deletingEventIds?.has(event.id) ? 'event-shrink-animation opacity-50' : ''
                                  } ${
                                    selectedEventId === event.id ? 'ring-2 ring-blue-400' : ''
                                  }`}
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
            </div>
          </div>
        </div>
      </div>
      
      {/* Floating Create Button */}
      {onCreateEvent && (
        <Button
          onClick={onCreateEvent}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 z-[60] flex items-center justify-center md:hidden"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
    </div>
  )
}