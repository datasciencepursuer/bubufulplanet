import { format, parseISO } from 'date-fns'

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
 */
export const normalizeDate = (date: string | Date): string => {
  if (typeof date === 'string') {
    // If it's already a date string, return as-is (assuming YYYY-MM-DD format)
    if (date.includes('-') && date.length === 10) {
      return date
    }
    // If it's an ISO string, parse and convert
    return dateToString(new Date(date))
  }
  
  return dateToString(date)
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
    ? `${formatDisplayDate(endDate)} at ${formatDisplayTime(endTime)}`
    : formatDisplayDate(endDate)
    
  return `${startDisplay} - ${endDisplay}`
}