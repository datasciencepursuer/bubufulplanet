'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, parseISO, isSameMonth, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Event, TripDay } from '@prisma/client'

interface MonthlyCalendarViewProps {
  tripStartDate: string
  tripEndDate: string
  tripDays: TripDay[]
  events: Event[]
  onDayClick: (dayId: string) => void
  onEventClick: (event: Event) => void
}

export default function MonthlyCalendarView({
  tripStartDate,
  tripEndDate,
  tripDays,
  events,
  onDayClick,
  onEventClick
}: MonthlyCalendarViewProps) {
  const startDate = parseISO(tripStartDate)
  const endDate = parseISO(tripEndDate)
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    // If today is within the trip dates, show the current month
    if (today >= startDate && today <= endDate) {
      return startOfMonth(today)
    }
    // Otherwise show the start month of the trip
    return startOfMonth(startDate)
  })


  const currentMonthStart = startOfMonth(currentMonth)
  const currentMonthEnd = endOfMonth(currentMonth)
  const nextMonth = addMonths(currentMonth, 1)
  const nextMonthStart = startOfMonth(nextMonth)
  const nextMonthEnd = endOfMonth(nextMonth)

  // Get calendar grid days (including only leading days, no trailing days)
  const getCurrentMonthGrid = () => {
    const start = startOfWeek(currentMonthStart, { weekStartsOn: 0 }) // Sunday start
    const end = currentMonthEnd // End at last day of month, no trailing days
    return eachDayOfInterval({ start, end })
  }

  const getPaddedCurrentMonthDays = (monthDays: Date[]) => {
    if (monthDays.length === 0) return []
    
    // Calculate how many days to add to complete the grid
    const remainder = monthDays.length % 7
    const paddingNeeded = remainder === 0 ? 0 : 7 - remainder
    const paddingCells = Array(paddingNeeded).fill(null)
    
    return [...monthDays, ...paddingCells]
  }

  const getNextMonthGrid = () => {
    // Start from the next month's first day instead of the week containing it
    // This prevents overlap with trailing days from the current month
    const start = nextMonthStart
    const end = endOfWeek(nextMonthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }

  const getPaddedNextMonthDays = (monthDays: Date[]) => {
    if (monthDays.length === 0) return []
    
    // Get the day of week for the first day (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = monthDays[0].getDay()
    
    // Create empty slots for days before the month starts
    const paddingCells = Array(firstDayOfWeek).fill(null)
    
    return [...paddingCells, ...monthDays]
  }

  const currentMonthDays = getCurrentMonthGrid()
  const nextMonthDays = getNextMonthGrid()

  const tripDaysByDate = useMemo(() => {
    const byDate: Record<string, TripDay> = {}
    tripDays.forEach(td => {
      byDate[td.date] = td
    })
    return byDate
  }, [tripDays])

  const eventsByDay = useMemo(() => {
    const byDay: Record<string, Event[]> = {}
    events.forEach(event => {
      if (!byDay[event.day_id]) {
        byDay[event.day_id] = []
      }
      byDay[event.day_id].push(event)
    })
    return byDay
  }, [events])

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const isWithinTripDates = (date: Date): boolean => {
    return date >= startDate && date <= endDate
  }

  const getTripDayForDate = (date: Date): TripDay | null => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return tripDaysByDate[dateStr] || null
  }


  const renderMonth = (monthDays: Date[], monthName: string, isCurrentMonth: boolean) => {
    const monthStart = isCurrentMonth ? currentMonthStart : nextMonthStart
    
    // Pad both months appropriately
    const paddedDays = isCurrentMonth ? getPaddedCurrentMonthDays(monthDays) : getPaddedNextMonthDays(monthDays)
    
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-center">{monthName}</h3>
        </div>
        
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {paddedDays.map((date, index) => {
            // Handle padding cells for next month alignment
            if (!date) {
              return <div key={`empty-${index}`} className="min-h-[100px] border-r border-b bg-gray-50"></div>
            }
            const tripDay = getTripDayForDate(date)
            const isInCurrentMonth = isSameMonth(date, monthStart)
            const isWithinTrip = isWithinTripDates(date)
            const isClickable = tripDay && isWithinTrip
            const dayEvents = tripDay ? eventsByDay[tripDay.id] || [] : []
            
            return (
              <div
                key={date.toISOString()}
                className={`min-h-[100px] p-2 border-r border-b relative ${
                  !isInCurrentMonth ? 'bg-gray-50 text-gray-400' :
                  isClickable ? 'cursor-pointer hover:bg-blue-50' : 
                  'bg-gray-100'
                }`}
                onClick={() => {
                  if (isClickable && tripDay) {
                    onDayClick(tripDay.id)
                  }
                }}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-medium ${
                    !isInCurrentMonth ? 'text-gray-400' :
                    isWithinTrip ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {format(date, 'd')}
                  </span>
                  {tripDay && isWithinTrip && (
                    <span className="text-xs text-blue-600 bg-blue-100 px-1 rounded">
                      Day {tripDay.day_number}
                    </span>
                  )}
                </div>
                
                {/* Events */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(event)
                      }}
                      className="gradient-bg text-white text-xs p-1 rounded cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 truncate"
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
                
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <h2 className="text-xl font-semibold">
          {format(currentMonth, 'MMMM yyyy')} - {format(nextMonth, 'MMMM yyyy')}
        </h2>
        
        <Button variant="outline" size="sm" onClick={goToNextMonth}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Two month grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderMonth(currentMonthDays, format(currentMonth, 'MMMM yyyy'), true)}
        {renderMonth(nextMonthDays, format(nextMonth, 'MMMM yyyy'), false)}
      </div>

      {/* Legend */}
      <div className="p-4 border rounded-lg bg-gray-50 text-sm text-gray-600">
        <div className="flex items-center space-x-4 flex-wrap">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
            <span>Trip Days</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-100 border rounded"></div>
            <span>Outside Trip Dates</span>
          </div>
          <span className="ml-4">Click days to view in weekly calendar.</span>
        </div>
      </div>
    </div>
  )
}