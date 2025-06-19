import { format, addDays, subDays } from 'date-fns'
import { normalizeDate as normalizeDateTime } from './dateTimeUtils'

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
  const extendedStart = subDays(new Date(tripStartDate), 1)
  const extendedEnd = addDays(new Date(tripEndDate), 1)
  
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
      className: dateType === 'trip-day' 
        ? 'text-xs text-green-700 font-medium mt-1' 
        : 'text-xs text-amber-700 font-medium mt-1 bg-amber-100 px-1 rounded',
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
      ? 'bg-amber-50 cursor-not-allowed opacity-75'
      : 'bg-gray-100'
  }
}

/**
 * ADDITIONAL DATE UTILITIES
 * Extended utilities for consistent date handling across the application
 */

/**
 * Converts a Date object to YYYY-MM-DD string without timezone issues
 */
export const dateToString = (date: Date): string => {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Converts a date string (YYYY-MM-DD) or Date to consistent YYYY-MM-DD format
 * @deprecated Use normalizeDateTime from dateTimeUtils.ts for better error handling
 */
export const normalizeDate = (date: string | Date): string => {
  // Use the more robust implementation from dateTimeUtils
  return normalizeDateTime(date)
}

/**
 * Formats a date for display (handles both string and Date inputs)
 */
export const formatDisplayDate = (date: string | Date): string => {
  if (typeof date === 'string') {
    // Parse date string safely without timezone conversion
    const [year, month, day] = date.split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return format(localDate, 'EEEE, MMMM d, yyyy')
  }
  
  return format(date, 'EEEE, MMMM d, yyyy')
}

/**
 * Formats time for display (HH:mm to h:mm a)
 */
export const formatDisplayTime = (time: string | Date): string => {
  if (typeof time === 'string') {
    // If it's a time string (HH:mm), create a date for formatting
    return format(new Date(`2000-01-01T${time}`), 'h:mm a')
  }
  
  return format(time, 'h:mm a')
}

/**
 * Extracts time string (HH:mm) from Date object
 */
export const extractTimeString = (date: Date): string => {
  return date.toTimeString().slice(0, 5) // HH:MM format
}

/**
 * Formats date and time together for display
 */
export const formatDateTime = (date: string | Date, time?: string | Date): string => {
  const dateStr = formatDisplayDate(date)
  
  if (!time) {
    return dateStr
  }
  
  const timeStr = formatDisplayTime(time)
  return `${dateStr} at ${timeStr}`
}

/**
 * Formats date range for display
 */
export const formatDateRange = (
  startDate: string | Date, 
  startTime?: string | Date,
  endDate?: string | Date, 
  endTime?: string | Date
): string => {
  const startDateStr = normalizeDate(startDate)
  const endDateStr = endDate ? normalizeDate(endDate) : null
  
  // Same day event
  if (!endDateStr || startDateStr === endDateStr) {
    const dateDisplay = formatDisplayDate(startDate)
    
    if (startTime && endTime) {
      return `${dateDisplay}, ${formatDisplayTime(startTime)} - ${formatDisplayTime(endTime)}`
    } else if (startTime) {
      return `${dateDisplay} at ${formatDisplayTime(startTime)}`
    }
    
    return dateDisplay
  }
  
  // Multi-day event
  const startDisplay = startTime 
    ? `${formatDisplayDate(startDate)} at ${formatDisplayTime(startTime)}`
    : formatDisplayDate(startDate)
    
  const endDisplay = endTime
    ? `${formatDisplayDate(endDate!)} at ${formatDisplayTime(endTime)}`
    : formatDisplayDate(endDate!)
    
  return `${startDisplay} - ${endDisplay}`
}