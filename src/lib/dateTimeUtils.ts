import { format, parseISO, isValid } from 'date-fns'

// Consistent base date for time storage - using Unix epoch for consistency
const TIME_BASE_DATE = '1970-01-01'

/**
 * Normalize date input to consistent YYYY-MM-DD string format
 * Handles Date objects, ISO strings, and date strings
 */
export const normalizeDate = (date: Date | string): string => {
  try {
    if (typeof date === 'string') {
      // Handle various string formats
      const parsed = parseISO(date.includes('T') ? date.split('T')[0] : date)
      if (!isValid(parsed)) {
        throw new Error(`Invalid date string: ${date}`)
      }
      return format(parsed, 'yyyy-MM-dd')
    } else if (date instanceof Date) {
      if (!isValid(date)) {
        throw new Error(`Invalid Date object: ${date}`)
      }
      return format(date, 'yyyy-MM-dd')
    } else {
      throw new Error(`Unsupported date type: ${typeof date}`)
    }
  } catch (error) {
    console.error('Date normalization error:', error)
    // Fallback to current date
    return format(new Date(), 'yyyy-MM-dd')
  }
}

/**
 * Format time string for consistent database storage
 * Always uses 1970-01-01 as base date to avoid timezone issues
 */
export const formatTimeForStorage = (timeString: string): Date => {
  try {
    // Validate time format (HH:MM or HH:MM:SS)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/
    if (!timeRegex.test(timeString)) {
      throw new Error(`Invalid time format: ${timeString}`)
    }

    // Ensure HH:MM:SS format
    const timeParts = timeString.split(':')
    const formattedTime = timeParts.length === 2 
      ? `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:00`
      : `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:${timeParts[2].padStart(2, '0')}`

    const dateTime = new Date(`${TIME_BASE_DATE}T${formattedTime}`)
    
    if (!isValid(dateTime)) {
      throw new Error(`Invalid time: ${timeString}`)
    }
    
    return dateTime
  } catch (error) {
    console.error('Time formatting error:', error)
    // Fallback to 00:00:00
    return new Date(`${TIME_BASE_DATE}T00:00:00`)
  }
}

/**
 * Extract time string from stored DateTime (removes arbitrary date part)
 */
export const extractTimeFromDateTime = (dateTime: Date): string => {
  try {
    if (!isValid(dateTime)) {
      throw new Error(`Invalid DateTime: ${dateTime}`)
    }
    return format(dateTime, 'HH:mm:ss')
  } catch (error) {
    console.error('Time extraction error:', error)
    return '00:00:00'
  }
}

/**
 * Extract time string in HH:MM format (8-character format used in components)
 */
export const extractTimeString = (dateTime: Date): string => {
  return extractTimeFromDateTime(dateTime).slice(0, 8)
}

/**
 * Validate date range for events
 */
export const validateDateRange = (startDate: string, endDate?: string): boolean => {
  try {
    const start = parseISO(startDate)
    if (!isValid(start)) {
      return false
    }

    if (endDate) {
      const end = parseISO(endDate)
      if (!isValid(end)) {
        return false
      }
      return start <= end
    }

    return true
  } catch {
    return false
  }
}

/**
 * Get array of dates between start and end date (inclusive)
 */
export const getDateRange = (startDate: string, endDate?: string): Date[] => {
  try {
    const start = parseISO(startDate)
    const end = endDate ? parseISO(endDate) : start
    
    if (!isValid(start) || !isValid(end)) {
      return [new Date()]
    }

    const dates: Date[] = []
    const current = new Date(start)
    
    while (current <= end) {
      dates.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    
    return dates
  } catch (error) {
    console.error('Date range calculation error:', error)
    return [new Date()]
  }
}

/**
 * Check if a date falls within a date range
 */
export const isDateInRange = (date: Date | string, startDate: string, endDate?: string): boolean => {
  try {
    const checkDate = typeof date === 'string' ? parseISO(date) : date
    const start = parseISO(startDate)
    const end = endDate ? parseISO(endDate) : start
    
    if (!isValid(checkDate) || !isValid(start) || !isValid(end)) {
      return false
    }
    
    return checkDate >= start && checkDate <= end
  } catch {
    return false
  }
}

/**
 * Create consistent event date/time object for API
 */
export const createEventDateTime = (dateString: string, timeString: string): {
  date: string
  time: Date
} => {
  return {
    date: normalizeDate(dateString),
    time: formatTimeForStorage(timeString)
  }
}

/**
 * Parse event data from API response
 */
export const parseEventResponse = (event: any): {
  startDate: string
  endDate: string | null
  startTime: string
  endTime: string | null
} => {
  return {
    startDate: normalizeDate(event.start_date || event.startDate),
    endDate: event.end_date || event.endDate ? normalizeDate(event.end_date || event.endDate) : null,
    startTime: extractTimeString(new Date(event.start_time || event.startTime)),
    endTime: event.end_time || event.endTime ? extractTimeString(new Date(event.end_time || event.endTime)) : null
  }
}

/**
 * Format event data for API submission
 */
export const formatEventForAPI = (eventData: {
  dayId: string
  title: string
  startTime: string
  endTime?: string
  startDate: string
  endDate?: string
  location?: string
  notes?: string
  weather?: string
  loadout?: string
  color: string
}): any => {
  return {
    day_id: eventData.dayId,
    title: eventData.title,
    start_time: eventData.startTime,
    end_time: eventData.endTime || null,
    start_date: normalizeDate(eventData.startDate),
    end_date: eventData.endDate ? normalizeDate(eventData.endDate) : null,
    location: eventData.location || null,
    notes: eventData.notes || null,
    weather: eventData.weather || null,
    loadout: eventData.loadout || null,
    color: eventData.color
  }
}

/**
 * Calculate default end time (1 hour after start time)
 */
export const calculateDefaultEndTime = (startTime: string): string => {
  try {
    const [hours, minutes] = startTime.split(':').map(Number)
    let endHours = hours + 1
    let endMinutes = minutes
    
    if (endHours >= 24) {
      endHours = endHours % 24
    }
    
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
  } catch (error) {
    console.error('Error calculating default end time:', error)
    return '01:00' // Default 1 hour fallback
  }
}

/**
 * Convert 24-hour time to 12-hour components
 */
export const to12HourComponents = (time24: string): { time: string; period: 'AM' | 'PM' } => {
  try {
    // Handle empty, null, or undefined input
    if (!time24 || typeof time24 !== 'string') {
      console.warn('Invalid time24 input:', time24)
      return { time: '12:00', period: 'AM' }
    }
    
    const timeParts = time24.split(':')
    if (timeParts.length < 2) {
      console.warn('Invalid time format:', time24)
      return { time: '12:00', period: 'AM' }
    }
    
    const hours = parseInt(timeParts[0], 10)
    const minutes = parseInt(timeParts[1], 10)
    
    // Validate parsed values
    if (isNaN(hours) || isNaN(minutes)) {
      console.warn('Invalid time values:', { hours, minutes, input: time24 })
      return { time: '12:00', period: 'AM' }
    }
    
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return {
      time: `${displayHours}:${minutes.toString().padStart(2, '0')}`,
      period
    }
  } catch (error) {
    console.error('Error converting to 12-hour format:', error)
    return { time: '12:00', period: 'AM' }
  }
}

/**
 * Convert 12-hour time to 24-hour format
 */
export const to24HourTime = (time12: string, period: 'AM' | 'PM'): string => {
  try {
    const [hours, minutes] = time12.split(':').map(Number)
    let hours24 = hours
    
    if (period === 'AM' && hours === 12) {
      hours24 = 0
    } else if (period === 'PM' && hours !== 12) {
      hours24 = hours + 12
    }
    
    return `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  } catch (error) {
    console.error('Error converting to 24-hour format:', error)
    return '00:00'
  }
}

/**
 * 12-hour time options for dropdowns
 */
export const TIME_OPTIONS_12H = [
  '12:00', '12:30', '1:00', '1:30', '2:00', '2:30', '3:00', '3:30', '4:00', '4:30', '5:00', '5:30',
  '6:00', '6:30', '7:00', '7:30', '8:00', '8:30', '9:00', '9:30', '10:00', '10:30', '11:00', '11:30'
]