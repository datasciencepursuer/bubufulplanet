'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { format, addDays, subDays, parseISO, differenceInDays, eachDayOfInterval } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, Edit, MapPin, FileText, Trash2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Event, TripDay } from '@prisma/client'
import { EVENT_COLORS, getEventColor } from '@/lib/eventColors'
import { getTripDateInfo, getTripDateStyles, normalizeDate } from '@/lib/tripDayUtils'
import { TIME_SLOTS, formatTimeSlot } from '@/lib/timeSlotUtils'

interface MobileCalendarViewProps {
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
  onDeleteEvent?: (eventId: string) => void
  initialDate?: string | null
}

export default function MobileCalendarView({
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
  onDeleteEvent,
  initialDate
}: MobileCalendarViewProps) {
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

  // Pre-render trip days map for quick lookup
  const tripDaysMap = useMemo(() => {
    const map = new Map()
    tripDays.forEach(td => {
      const dateStr = normalizeDate(new Date(td.date))
      map.set(dateStr, td)
    })
    return map
  }, [tripDays])

  // Get trip day for current date
  const currentTripDay = useMemo(() => {
    const targetDateStr = normalizeDate(currentDate)
    return tripDaysMap.get(targetDateStr)
  }, [currentDate, tripDaysMap])

  // Get events for current day
  const eventsForDay = useMemo(() => {
    if (!currentTripDay) return []
    return events
      .filter(event => event.dayId === currentTripDay.id)
      .sort((a, b) => a.startSlot.localeCompare(b.startSlot))
  }, [currentTripDay, events])

  // Find the next day with events or end of trip
  const findNextEventDay = useCallback((fromDate: Date): Date | null => {
    let checkDate = addDays(fromDate, 1)
    
    while (checkDate <= endDate) {
      const dateStr = normalizeDate(checkDate)
      const tripDay = tripDaysMap.get(dateStr)
      
      if (tripDay) {
        const dayEvents = events.filter(event => event.dayId === tripDay.id)
        if (dayEvents.length > 0) {
          return checkDate
        }
      }
      
      checkDate = addDays(checkDate, 1)
    }
    
    return null
  }, [endDate, tripDaysMap, events])

  // Find the previous day with events or start of trip
  const findPreviousEventDay = useCallback((fromDate: Date): Date | null => {
    let checkDate = subDays(fromDate, 1)
    
    while (checkDate >= startDate) {
      const dateStr = normalizeDate(checkDate)
      const tripDay = tripDaysMap.get(dateStr)
      
      if (tripDay) {
        const dayEvents = events.filter(event => event.dayId === tripDay.id)
        if (dayEvents.length > 0) {
          return checkDate
        }
      }
      
      checkDate = subDays(checkDate, 1)
    }
    
    return null
  }, [startDate, tripDaysMap, events])

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

  const jumpToPreviousEventDay = () => {
    const prevEventDay = findPreviousEventDay(currentDate)
    if (prevEventDay) {
      setCurrentDate(prevEventDay)
    }
  }

  const jumpToNextEventDay = () => {
    const nextEventDay = findNextEventDay(currentDate)
    if (nextEventDay) {
      setCurrentDate(nextEventDay)
    }
  }

  const canGoToPrevious = currentDate > startDate
  const canGoToNext = currentDate < endDate
  const isWithinTripDates = currentTripDay !== undefined

  // Generate gap summary for empty days
  const generateGapSummary = () => {
    if (eventsForDay.length > 0) return null

    // Find the range of consecutive empty days
    let startGapDate = currentDate
    let endGapDate = currentDate

    // Extend backwards to find start of gap
    let checkDate = subDays(currentDate, 1)
    while (checkDate >= startDate) {
      const dateStr = normalizeDate(checkDate)
      const tripDay = tripDaysMap.get(dateStr)
      
      if (tripDay) {
        const dayEvents = events.filter(event => event.dayId === tripDay.id)
        if (dayEvents.length === 0) {
          startGapDate = checkDate
          checkDate = subDays(checkDate, 1)
        } else {
          break
        }
      } else {
        break
      }
    }

    // Extend forwards to find end of gap
    checkDate = addDays(currentDate, 1)
    while (checkDate <= endDate) {
      const dateStr = normalizeDate(checkDate)
      const tripDay = tripDaysMap.get(dateStr)
      
      if (tripDay) {
        const dayEvents = events.filter(event => event.dayId === tripDay.id)
        if (dayEvents.length === 0) {
          endGapDate = checkDate
          checkDate = addDays(checkDate, 1)
        } else {
          break
        }
      } else {
        break
      }
    }

    const gapDays = differenceInDays(endGapDate, startGapDate) + 1
    
    if (gapDays > 1) {
      return {
        startDate: startGapDate,
        endDate: endGapDate,
        days: gapDays,
        summary: `${format(startGapDate, 'MMM d')} - ${format(endGapDate, 'MMM d')}`
      }
    }

    return null
  }

  const gapInfo = generateGapSummary()

  return (
    <div className="bg-white rounded-lg border flex flex-col h-full">
      {/* Mobile-Optimized Day Navigation */}
      <div className="flex justify-between items-center p-4 border-b gradient-bg flex-shrink-0">
        <div className="flex items-center space-x-1">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToPreviousDay}
            disabled={!canGoToPrevious}
            className="shadow-sm hover:shadow-md transition-shadow px-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {findPreviousEventDay(currentDate) && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={jumpToPreviousEventDay}
              className="shadow-sm hover:shadow-md transition-shadow px-2 text-xs"
              title="Jump to previous day with events"
            >
              <ArrowRight className="h-3 w-3 rotate-180" />
              Event
            </Button>
          )}
        </div>
        
        <div className="text-center flex-1 px-2">
          <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">
            {format(currentDate, 'EEE, MMM d')}
          </h2>
          <p className="text-xs text-green-100">{format(currentDate, 'yyyy')}</p>
          {(() => {
            const dateInfo = getTripDateInfo(currentDate, tripStartDate, tripEndDate)
            const styles = getTripDateStyles(dateInfo)
            
            return styles.dayLabel.show && (
              <div className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                {styles.dayLabel.text}{dateInfo.dateType === 'trip-day' ? ' of trip' : ''}
              </div>
            )
          })()}
        </div>
        
        <div className="flex items-center space-x-1">
          {findNextEventDay(currentDate) && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={jumpToNextEventDay}
              className="shadow-sm hover:shadow-md transition-shadow px-2 text-xs"
              title="Jump to next day with events"
            >
              Event
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToNextDay}
            disabled={!canGoToNext}
            className="shadow-sm hover:shadow-md transition-shadow px-2"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Add Event Button */}
      <div className="p-3 border-b bg-gray-50 flex gap-3">
        <Button 
          variant="default" 
          size="sm"
          onClick={() => {
            if (currentTripDay && isWithinTripDates) {
              onTimeSlotClick(currentTripDay.id, '09:00', '10:00')
            }
          }}
          disabled={!currentTripDay || !isWithinTripDates}
          className="shadow-sm flex-1"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      {/* Daily Schedule Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Gap Day Summary */}
        {gapInfo && (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4 text-center">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <h3 className="text-lg font-semibold text-blue-800 mb-1">Free Days</h3>
              <p className="text-blue-700 font-medium">{gapInfo.summary}</p>
              <p className="text-sm text-blue-600 mt-1">
                {gapInfo.days} {gapInfo.days === 1 ? 'day' : 'days'} with no scheduled events
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  if (currentTripDay && isWithinTripDates) {
                    onTimeSlotClick(currentTripDay.id, '09:00', '10:00')
                  }
                }}
                disabled={!currentTripDay || !isWithinTripDates}
                className="mt-3 border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                <Plus className="h-4 w-4 mr-2" />
                Plan Something
              </Button>
            </div>
          </div>
        )}

        {/* Events Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-blue-500" />
              Events ({eventsForDay.length})
            </h3>
          </div>
          
          {eventsForDay.length === 0 && !gapInfo ? (
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
            <div className="space-y-3">
              {eventsForDay.map((event, index) => (
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <h4 className="font-semibold text-base text-gray-800 leading-tight">{event.title}</h4>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <Clock className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>
                          {formatTimeSlot(event.startSlot)}
                          {event.endSlot && ` - ${formatTimeSlot(event.endSlot)}`}
                        </span>
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center text-sm text-gray-600 mb-2">
                          <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick(event)
                        }}
                        className="h-8 w-8 p-0"
                        title="Edit event"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {onDeleteEvent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteEvent(event.id)
                          }}
                          className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                          title="Delete event"
                          disabled={deletingEventIds?.has(event.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {event.notes && (
                    <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg mt-3">
                      <FileText className="h-4 w-4 inline mr-1" />
                      {event.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}