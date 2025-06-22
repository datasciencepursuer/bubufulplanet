'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createAbsoluteDate, createAbsoluteDateRange } from '@/lib/dateTimeUtils'

interface AppMonthlyCalendarProps {
  onTripSelect: (startDate: Date, endDate: Date) => void
  onCreateTrip?: () => void
  existingTrips?: Array<{
    id: string
    title: string
    start: string
    end: string
  }>
}

export default function AppMonthlyCalendar({ onTripSelect, onCreateTrip, existingTrips = [] }: AppMonthlyCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => 
    startOfMonth(new Date())
  )

  // Drag selection state
  const [dragState, setDragState] = useState<{
    isActive: boolean
    startDate: Date | null
    endDate: Date | null
    selectedDates: Date[]
  }>({
    isActive: false,
    startDate: null,
    endDate: null,
    selectedDates: []
  })

  // Create timezone-agnostic month boundaries
  const getMonthStart = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return createAbsoluteDate(`${year}-${String(month + 1).padStart(2, '0')}-01`)
  }
  
  const getMonthEnd = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    // Get last day of month
    const lastDay = new Date(year, month + 1, 0).getDate()
    return createAbsoluteDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)
  }
  
  const currentMonthStart = getMonthStart(currentMonth)
  const currentMonthEnd = getMonthEnd(currentMonth)
  const nextMonth = addMonths(currentMonth, 1)
  const nextMonthStart = getMonthStart(nextMonth)
  const nextMonthEnd = getMonthEnd(nextMonth)

  // Get calendar grid days with proper week alignment
  const getCurrentMonthGrid = () => {
    const days = createAbsoluteDateRange(currentMonthStart, currentMonthEnd)
    
    // Since our dates are timezone-agnostic (created with UTC), use UTC day
    const firstDayOfWeek = currentMonthStart.getUTCDay() // 0 = Sunday, 1 = Monday, etc.
    const emptyCells = Array(firstDayOfWeek).fill(null)
    return [...emptyCells, ...days]
  }

  const getNextMonthGrid = () => {
    const days = createAbsoluteDateRange(nextMonthStart, nextMonthEnd)
    
    // Since our dates are timezone-agnostic (created with UTC), use UTC day
    const firstDayOfWeek = nextMonthStart.getUTCDay() // 0 = Sunday, 1 = Monday, etc.
    const emptyCells = Array(firstDayOfWeek).fill(null)
    return [...emptyCells, ...days]
  }

  const currentMonthDays = getCurrentMonthGrid()
  const nextMonthDays = getNextMonthGrid()

  // Convert existing trips to date ranges for display
  const tripRanges = useMemo(() => {
    if (!existingTrips || existingTrips.length === 0) {
      return []
    }
    
    return existingTrips.map(trip => {
      // Ensure we have valid date strings
      if (!trip.start || !trip.end) {
        console.error('Invalid trip dates:', trip)
        return null
      }
      
      const start = createAbsoluteDate(trip.start)
      const end = createAbsoluteDate(trip.end)
      const dates = eachDayOfInterval({ start, end })
      
      return {
        ...trip,
        dates,
        startDate: start,
        endDate: end
      }
    }).filter((trip): trip is NonNullable<typeof trip> => trip !== null)
  }, [existingTrips])

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const isDayInTrip = (date: Date): boolean => {
    // Since all our dates are timezone-agnostic (created with UTC), 
    // we can safely use UTC methods for comparison
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    
    return tripRanges.some(trip => {
      if (!trip) return false
      // Check if date falls within trip range
      const tripStartYear = trip.startDate.getUTCFullYear()
      const tripStartMonth = String(trip.startDate.getUTCMonth() + 1).padStart(2, '0')
      const tripStartDay = String(trip.startDate.getUTCDate()).padStart(2, '0')
      const tripStartStr = `${tripStartYear}-${tripStartMonth}-${tripStartDay}`
      
      const tripEndYear = trip.endDate.getUTCFullYear()
      const tripEndMonth = String(trip.endDate.getUTCMonth() + 1).padStart(2, '0')
      const tripEndDay = String(trip.endDate.getUTCDate()).padStart(2, '0')
      const tripEndStr = `${tripEndYear}-${tripEndMonth}-${tripEndDay}`
      
      return dateStr >= tripStartStr && dateStr <= tripEndStr
    })
  }

  const isDaySelected = (date: Date): boolean => {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    
    return dragState.selectedDates.some(selectedDate => {
      const selYear = selectedDate.getUTCFullYear()
      const selMonth = String(selectedDate.getUTCMonth() + 1).padStart(2, '0')
      const selDay = String(selectedDate.getUTCDate()).padStart(2, '0')
      const selDateStr = `${selYear}-${selMonth}-${selDay}`
      return selDateStr === dateStr
    })
  }

  const handleMouseDown = (date: Date) => {
    if (isDayInTrip(date)) return // Don't start drag on existing trips
    
    setDragState({
      isActive: true,
      startDate: date,
      endDate: date,
      selectedDates: [date]
    })
  }

  const handleMouseEnter = (date: Date) => {
    if (dragState.isActive && dragState.startDate && !isDayInTrip(date)) {
      const startDate = dragState.startDate
      const endDate = date
      
      // Get all dates between start and current (inclusive)
      const selectedDates = eachDayOfInterval({
        start: startDate <= endDate ? startDate : endDate,
        end: startDate <= endDate ? endDate : startDate
      })
      
      setDragState(prev => ({
        ...prev,
        endDate: date,
        selectedDates
      }))
    }
  }

  const handleMouseUp = useCallback(() => {
    if (dragState.isActive && dragState.startDate && dragState.endDate) {
      const startDate = dragState.startDate <= dragState.endDate ? dragState.startDate : dragState.endDate
      const endDate = dragState.startDate <= dragState.endDate ? dragState.endDate : dragState.startDate
      
      // Use inclusive end date (no adjustment needed)
      onTripSelect(startDate, endDate)
    }
    
    setDragState({
      isActive: false,
      startDate: null,
      endDate: null,
      selectedDates: []
    })
  }, [dragState, onTripSelect])

  // Add global mouseup listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragState.isActive) {
        handleMouseUp()
      }
    }

    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [dragState.isActive, handleMouseUp])

  const renderMonth = (monthDays: (Date | null)[], monthName: string) => {
    
    return (
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold text-center">{monthName}</h3>
        </div>
        
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 bg-gray-50">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7 auto-rows-fr">
          {monthDays.map((date, index) => {
            // Handle empty cells for proper day alignment
            if (date === null) {
              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-[80px] p-2 border-r border-b bg-gray-50"
                />
              )
            }

            const isInTrip = isDayInTrip(date)
            const isSelected = isDaySelected(date)
            const isPastDate = date < new Date(new Date().setHours(0, 0, 0, 0))
            const isClickable = !isInTrip && !isPastDate
            
            return (
              <div
                key={date.toISOString()}
                className={`min-h-[80px] p-2 border-r border-b relative select-none ${
                  isPastDate ? 'bg-gray-100 text-gray-400' :
                  isInTrip ? 'bg-blue-100 border-blue-200' :
                  isClickable ? 'cursor-pointer hover:bg-blue-50' : 
                  'bg-white'
                } ${isSelected ? 'bg-blue-200 hover:bg-blue-300' : ''}`}
                onMouseDown={() => {
                  if (isClickable) {
                    handleMouseDown(date)
                  }
                }}
                onMouseEnter={() => {
                  if (isClickable) {
                    handleMouseEnter(date)
                  }
                }}
                onClick={() => {
                  if (isClickable && !dragState.isActive) {
                    onTripSelect(date, date)
                  }
                }}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-medium ${
                    isPastDate ? 'text-gray-400' : 'text-gray-900'
                  }`}>
                    {date.getUTCDate()}
                  </span>
                  {isInTrip && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
                
                {/* Trip indicators */}
                {isInTrip && (
                  <div className="text-xs text-blue-700 truncate">
                    {tripRanges
                      .filter(trip => {
                        if (!trip) return false
                        const year = date.getUTCFullYear()
                        const month = String(date.getUTCMonth() + 1).padStart(2, '0')
                        const day = String(date.getUTCDate()).padStart(2, '0')
                        const dateStr = `${year}-${month}-${day}`
                        
                        const tripStartYear = trip.startDate.getUTCFullYear()
                        const tripStartMonth = String(trip.startDate.getUTCMonth() + 1).padStart(2, '0')
                        const tripStartDay = String(trip.startDate.getUTCDate()).padStart(2, '0')
                        const tripStartStr = `${tripStartYear}-${tripStartMonth}-${tripStartDay}`
                        
                        const tripEndYear = trip.endDate.getUTCFullYear()
                        const tripEndMonth = String(trip.endDate.getUTCMonth() + 1).padStart(2, '0')
                        const tripEndDay = String(trip.endDate.getUTCDate()).padStart(2, '0')
                        const tripEndStr = `${tripEndYear}-${tripEndMonth}-${tripEndDay}`
                        
                        return dateStr >= tripStartStr && dateStr <= tripEndStr
                      })
                      .map(trip => trip.title)
                      .join(', ')
                    }
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl glass shadow-modern overflow-hidden">
      <div className="p-6">
        {/* Navigation */}
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">
              {format(currentMonth, 'MMMM yyyy')} - {format(nextMonth, 'MMMM yyyy')}
            </h2>
            {onCreateTrip && (
              <Button 
                onClick={onCreateTrip}
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Trip
              </Button>
            )}
          </div>
          
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Two month grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderMonth(currentMonthDays, format(currentMonth, 'MMMM yyyy'))}
          {renderMonth(nextMonthDays, format(nextMonth, 'MMMM yyyy'))}
        </div>
      </div>
      
      {/* Selected dates display */}
      {dragState.selectedDates.length > 0 && (
        <div className="bg-gradient-to-r from-teal-500/10 to-cyan-500/10 p-4 border-t border-teal-200/20">
          <p className="text-sm font-medium text-teal-800">
            ✈️ Selected dates: {format(dragState.selectedDates[0], 'MMM d, yyyy')} - {format(dragState.selectedDates[dragState.selectedDates.length - 1], 'MMM d, yyyy')}
          </p>
        </div>
      )}
    </div>
  )
}