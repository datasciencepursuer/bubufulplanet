import { format } from 'date-fns'

/**
 * Trip Day Calculation Utilities
 * 
 * Provides consistent calculations for trip day numbering and date classification
 * across all calendar views. Uses local time without timezone management.
 */

export interface TripDateInfo {
  dayNumber: number | null
  dateType: 'trip-day' | 'before' | 'after' | 'outside-range'
  isWithinTripDates: boolean
  isWithinExtendedRange: boolean
}

/**
 * Calculate the trip day number for a given date
 * @param currentDate - The date to calculate the day number for
 * @param tripStartDate - Trip start date as ISO string (YYYY-MM-DD)
 * @returns Day number (1, 2, 3...) or null if not a trip day
 */
export function calculateTripDayNumber(currentDate: Date, tripStartDate: string): number | null {
  const currentDateStr = format(currentDate, 'yyyy-MM-dd')
  
  // If they're the same date, it's Day 1
  if (currentDateStr === tripStartDate) return 1
  
  // Calculate difference in days using simple time difference
  const current = new Date(currentDateStr)
  const start = new Date(tripStartDate)
  const diffTime = current.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  // Only return positive day numbers for dates after start
  return diffDays > 0 ? diffDays + 1 : null
}

/**
 * Check if a date is within the actual trip dates (not buffer days)
 * @param date - Date to check
 * @param tripStartDate - Trip start date as ISO string
 * @param tripEndDate - Trip end date as ISO string
 * @returns true if date is within trip dates
 */
export function isWithinTripDates(date: Date, tripStartDate: string, tripEndDate: string): boolean {
  const dateStr = format(date, 'yyyy-MM-dd')
  return dateStr >= tripStartDate && dateStr <= tripEndDate
}

/**
 * Check if a date is within the extended range (trip dates + buffer days)
 * @param date - Date to check
 * @param tripStartDate - Trip start date as ISO string
 * @param tripEndDate - Trip end date as ISO string
 * @returns true if date is within extended range
 */
export function isWithinExtendedRange(date: Date, tripStartDate: string, tripEndDate: string): boolean {
  const dateStr = format(date, 'yyyy-MM-dd')
  // Extended range includes 1 day before and after
  const extendedStart = new Date(tripStartDate)
  extendedStart.setDate(extendedStart.getDate() - 1)
  const extendedEnd = new Date(tripEndDate)
  extendedEnd.setDate(extendedEnd.getDate() + 1)
  
  const extendedStartStr = format(extendedStart, 'yyyy-MM-dd')
  const extendedEndStr = format(extendedEnd, 'yyyy-MM-dd')
  
  return dateStr >= extendedStartStr && dateStr <= extendedEndStr
}

/**
 * Get comprehensive information about a date in relation to a trip
 * @param date - Date to analyze
 * @param tripStartDate - Trip start date as ISO string
 * @param tripEndDate - Trip end date as ISO string
 * @returns Complete information about the date
 */
export function getTripDateInfo(date: Date, tripStartDate: string, tripEndDate: string): TripDateInfo {
  const isWithinTrip = isWithinTripDates(date, tripStartDate, tripEndDate)
  const isWithinExtended = isWithinExtendedRange(date, tripStartDate, tripEndDate)
  
  let dateType: TripDateInfo['dateType']
  let dayNumber: number | null = null
  
  if (isWithinTrip) {
    dateType = 'trip-day'
    dayNumber = calculateTripDayNumber(date, tripStartDate)
  } else if (isWithinExtended) {
    const dateStr = format(date, 'yyyy-MM-dd')
    dateType = dateStr < tripStartDate ? 'before' : 'after'
  } else {
    dateType = 'outside-range'
  }
  
  return {
    dayNumber,
    dateType,
    isWithinTripDates: isWithinTrip,
    isWithinExtendedRange: isWithinExtended
  }
}

/**
 * Get CSS classes for date styling based on trip date info
 * @param dateInfo - Trip date information
 * @returns Object with CSS classes for different elements
 */
export function getTripDateStyles(dateInfo: TripDateInfo) {
  const { dateType, isWithinTripDates } = dateInfo
  
  return {
    // Date number styling
    dateNumber: isWithinTripDates 
      ? 'text-gray-900' 
      : dateType === 'before' || dateType === 'after'
      ? 'text-amber-600'
      : 'text-gray-400',
    
    // Day label styling and text
    dayLabel: {
      show: dateType === 'trip-day' || dateType === 'before' || dateType === 'after',
      className: dateType === 'trip-day' ? 'text-xs text-green-700 mt-1' : 'text-xs text-amber-600 mt-1',
      text: dateType === 'trip-day' 
        ? `Day ${dateInfo.dayNumber}` 
        : dateType === 'before' 
        ? 'Before' 
        : dateType === 'after' 
        ? 'After' 
        : ''
    },
    
    // Background/container styling
    container: isWithinTripDates 
      ? 'cursor-pointer hover:bg-blue-50' 
      : dateType === 'before' || dateType === 'after'
      ? 'cursor-pointer hover:bg-amber-50'
      : 'bg-gray-100'
  }
}