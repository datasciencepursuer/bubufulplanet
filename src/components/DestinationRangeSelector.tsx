'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { MapPin, Plus, X, Calendar } from 'lucide-react'
import { normalizeDate } from '@/lib/dateTimeUtils'
import type { TripDay } from '@prisma/client'

interface DestinationRange {
  destination: string
  startDate: string
  endDate: string
  dayIds: string[]
}

interface DestinationRangeSelectorProps {
  tripDays: TripDay[]
  onSave: (ranges: DestinationRange[]) => void
  onCancel: () => void
  existingRanges?: DestinationRange[]
}

export default function DestinationRangeSelector({
  tripDays,
  onSave,
  onCancel,
  existingRanges = []
}: DestinationRangeSelectorProps) {
  const [ranges, setRanges] = useState<DestinationRange[]>([])
  const [initialized, setInitialized] = useState(false)
  
  // Initialize with existing destinations from trip days
  useEffect(() => {
    if (!initialized && tripDays.length > 0) {
      if (existingRanges.length > 0) {
        setRanges(existingRanges)
      } else {
        // Group consecutive days by destination
        const grouped: DestinationRange[] = []
        let currentRange: DestinationRange | null = null
        
        const sortedDays = [...tripDays].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        )
        
        for (const day of sortedDays) {
          const destination = day.destination || ''
          const dateStr = normalizeDate(day.date)
          
          if (!currentRange || currentRange.destination !== destination) {
            // Start a new range
            if (currentRange) {
              grouped.push(currentRange)
            }
            currentRange = {
              destination,
              startDate: dateStr,
              endDate: dateStr,
              dayIds: [day.id]
            }
          } else {
            // Extend current range
            currentRange.endDate = dateStr
            currentRange.dayIds.push(day.id)
          }
        }
        
        if (currentRange) {
          grouped.push(currentRange)
        }
        
        setRanges(grouped)
      }
      setInitialized(true)
    }
  }, [tripDays, existingRanges, initialized])

  const addNewRange = () => {
    if (tripDays.length === 0) return
    
    const firstDay = tripDays[0]
    const newRange: DestinationRange = {
      destination: '',
      startDate: normalizeDate(firstDay.date),
      endDate: normalizeDate(firstDay.date),
      dayIds: [firstDay.id]
    }
    
    setRanges([...ranges, newRange])
  }

  const removeRange = (index: number) => {
    setRanges(ranges.filter((_, i) => i !== index))
  }

  const updateRange = (index: number, updates: Partial<DestinationRange>) => {
    const newRanges = [...ranges]
    newRanges[index] = { ...newRanges[index], ...updates }
    
    // If dates changed, update dayIds
    if (updates.startDate || updates.endDate) {
      const range = newRanges[index]
      const affectedDays = tripDays.filter(day => {
        const dayDate = normalizeDate(day.date)
        return dayDate >= range.startDate && dayDate <= range.endDate
      })
      newRanges[index].dayIds = affectedDays.map(day => day.id)
    }
    
    setRanges(newRanges)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00Z')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`
  }

  const getDayCount = (startDate: string, endDate: string) => {
    const start = new Date(startDate + 'T00:00:00Z')
    const end = new Date(endDate + 'T00:00:00Z')
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays
  }

  const getAvailableDates = (currentIndex: number) => {
    // Get all dates not covered by other ranges
    const usedDates = new Set<string>()
    ranges.forEach((range, index) => {
      if (index !== currentIndex) {
        const start = new Date(range.startDate + 'T00:00:00Z')
        const end = new Date(range.endDate + 'T00:00:00Z')
        
        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          usedDates.add(normalizeDate(d))
        }
      }
    })
    
    return tripDays.filter(day => !usedDates.has(normalizeDate(day.date)))
  }

  const handleSave = () => {
    // Validate ranges
    const validRanges = ranges.filter(range => 
      range.destination.trim() !== '' && range.dayIds.length > 0
    )
    
    onSave(validRanges)
  }

  const tripStartDate = tripDays.length > 0 ? normalizeDate(tripDays[0].date) : ''
  const tripEndDate = tripDays.length > 0 ? normalizeDate(tripDays[tripDays.length - 1].date) : ''

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Set destinations for your trip days
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Assign cities or locations to date ranges during your trip.
        </p>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {ranges.map((range, index) => {
          const availableDates = getAvailableDates(index)
          const minDate = availableDates.length > 0 
            ? normalizeDate(new Date(Math.min(...availableDates.map(d => new Date(d.date).getTime()))))
            : tripStartDate
          const maxDate = availableDates.length > 0
            ? normalizeDate(new Date(Math.max(...availableDates.map(d => new Date(d.date).getTime()))))
            : tripEndDate

          return (
            <div key={index} className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500 mt-1" />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={range.destination}
                      onChange={(e) => updateRange(index, { destination: e.target.value })}
                      placeholder="Enter city or location..."
                      className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRange(index)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={range.startDate}
                    min={tripStartDate}
                    max={tripEndDate}
                    onChange={(e) => updateRange(index, { 
                      startDate: e.target.value,
                      endDate: e.target.value > range.endDate ? e.target.value : range.endDate
                    })}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={range.endDate}
                    min={range.startDate}
                    max={tripEndDate}
                    onChange={(e) => updateRange(index, { endDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600 bg-white rounded-md px-3 py-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {formatDate(range.startDate)} - {formatDate(range.endDate)}
                  </span>
                </div>
                <span className="font-medium">
                  {getDayCount(range.startDate, range.endDate)} day{getDayCount(range.startDate, range.endDate) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={addNewRange}
          className="gap-2"
          disabled={ranges.length >= tripDays.length}
        >
          <Plus className="h-4 w-4" />
          Add Destination
        </Button>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Destinations
          </Button>
        </div>
      </div>
    </div>
  )
}