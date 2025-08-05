import { revalidateTag } from 'next/cache'

// Cache tags for different data types
export const CACHE_TAGS = {
  // Trip-related tags
  TRIPS: (groupId: string) => `trips-${groupId}`,
  TRIP: (tripId: string) => `trip-${tripId}`,
  TRIP_DAYS: (tripId: string) => `trip-days-${tripId}`,
  
  // Event-related tags
  EVENTS: (groupId: string) => `events-${groupId}`,
  TRIP_EVENTS: (tripId: string) => `events-trip-${tripId}`,
  DAY_EVENTS: (dayId: string) => `events-day-${dayId}`,
  
  // Expense-related tags
  EXPENSES: (groupId: string) => `expenses-${groupId}`,
  TRIP_EXPENSES: (tripId: string) => `expenses-trip-${tripId}`,
  
  // Combined data tags
  TRIP_DATA: (tripId: string) => `trip-data-${tripId}`,
} as const

// Cache durations in seconds (3 months = ~7,776,000 seconds)
// Long cache durations are safe because we use tag-based revalidation
// Data is automatically invalidated whenever trips/events are modified
export const CACHE_DURATIONS = {
  TRIPS: 7776000,        // 3 months - invalidated on trip create/update/delete
  EVENTS: 7776000,       // 3 months - invalidated on event create/update/delete  
  EXPENSES: 7776000,     // 3 months - invalidated on expense changes
  TRIP_DATA: 7776000,    // 3 months - invalidated on any trip data changes
} as const

// Helper functions for cache revalidation
export class CacheManager {
  /**
   * Revalidate all trip-related caches for a group
   */
  static revalidateTrips(groupId: string) {
    revalidateTag(CACHE_TAGS.TRIPS(groupId))
  }

  /**
   * Revalidate specific trip and related data
   */
  static revalidateTrip(tripId: string, groupId: string) {
    // Revalidate specific trip
    revalidateTag(CACHE_TAGS.TRIP(tripId))
    revalidateTag(CACHE_TAGS.TRIP_DAYS(tripId))
    revalidateTag(CACHE_TAGS.TRIP_DATA(tripId))
    
    // Revalidate group trips list
    revalidateTag(CACHE_TAGS.TRIPS(groupId))
    
    console.log(`Cache revalidated for trip ${tripId} and group ${groupId}`)
  }

  /**
   * Revalidate all event-related caches for a trip
   */
  static revalidateEvents(tripId: string, groupId: string, dayId?: string) {
    // Revalidate trip events
    revalidateTag(CACHE_TAGS.TRIP_EVENTS(tripId))
    revalidateTag(CACHE_TAGS.EVENTS(groupId))
    
    // Revalidate specific day events if provided
    if (dayId) {
      revalidateTag(CACHE_TAGS.DAY_EVENTS(dayId))
    }
    
    // Revalidate full trip data since it includes events
    revalidateTag(CACHE_TAGS.TRIP_DATA(tripId))
    
    console.log(`Cache revalidated for events in trip ${tripId}, group ${groupId}${dayId ? `, day ${dayId}` : ''}`)
  }

  /**
   * Revalidate expense-related caches
   */
  static revalidateExpenses(tripId: string, groupId: string) {
    revalidateTag(CACHE_TAGS.TRIP_EXPENSES(tripId))
    revalidateTag(CACHE_TAGS.EXPENSES(groupId))
    revalidateTag(CACHE_TAGS.TRIP_DATA(tripId))
    
    console.log(`Cache revalidated for expenses in trip ${tripId}, group ${groupId}`)
  }

  /**
   * Generate cache headers for responses
   */
  static getCacheHeaders(duration: number, tags: string[]) {
    // For long cache durations, use a shorter stale-while-revalidate window
    const staleWhileRevalidate = Math.min(duration * 0.1, 86400) // Max 1 day stale
    return {
      'Cache-Control': `private, max-age=${duration}, stale-while-revalidate=${staleWhileRevalidate}`,
      'Cache-Tags': tags.join(', ')
    }
  }

  /**
   * Generate ETag for response
   */
  static generateETag(identifier: string, timestamp?: number) {
    const time = timestamp || Date.now()
    return `"${identifier}-${time}"`
  }
}

// Utility function to add cache tags to Next.js fetch or unstable_cache calls
export function getCacheTags(tags: string[]) {
  return { tags }
}

// Helper to create cache key from multiple parameters
export function createCacheKey(...parts: (string | number | undefined)[]): string {
  return parts.filter(Boolean).join('-')
}