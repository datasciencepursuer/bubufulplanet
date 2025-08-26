// Optimized group switching utility
// Replaces multiple API calls with a single consolidated endpoint

interface OptimizedGroupData {
  group: {
    id: string
    name: string
    accessCode: string
    createdAt: string
  }
  currentMember: {
    id: string
    name: string
    role: string
    permissions: any
    joinedAt: string
  }
  allMembers: Array<{
    id: string
    traveler_name: string
    role: string
    permissions: any
    joined_at: string
  }>
  trips: Array<{
    id: string
    name: string
    destination: string | null
    startDate: string
    endDate: string
    createdAt: string
  }>
  pointsOfInterest: Array<{
    id: string
    destinationName: string
    address: string | null
    notes: string | null
    link: string | null
    tripId: string | null
    trip: any
  }>
  expensesSummary: {
    currentMemberId: string
    currentMemberName: string
    totalYouOwe: number
    totalOwedToYou: number
    netBalance: number
    totalExpenses: number
    hasDetailedData: boolean
  }
  performance: {
    queryTimeMs: number
    dataPoints: {
      trips: number
      members: number
      pointsOfInterest: number
      expenses: number
    }
  }
}

export class OptimizedGroupSwitcher {
  private static instance: OptimizedGroupSwitcher
  private currentGroupData: OptimizedGroupData | null = null
  private switchingPromise: Promise<OptimizedGroupData> | null = null

  static getInstance(): OptimizedGroupSwitcher {
    if (!OptimizedGroupSwitcher.instance) {
      OptimizedGroupSwitcher.instance = new OptimizedGroupSwitcher()
    }
    return OptimizedGroupSwitcher.instance
  }

  /**
   * Switch to a group using the optimized endpoint
   * Returns all group data in a single call
   */
  async switchToGroup(groupId: string, fromCache: boolean = true): Promise<OptimizedGroupData> {
    console.log('OptimizedGroupSwitcher: Switching to group', groupId)
    const startTime = Date.now()

    // Prevent concurrent switches to the same group
    if (this.switchingPromise) {
      console.log('OptimizedGroupSwitcher: Switch already in progress, waiting...')
      return this.switchingPromise
    }

    // Check if we already have this group's data cached
    if (fromCache && this.currentGroupData?.group.id === groupId) {
      console.log('OptimizedGroupSwitcher: Using cached data for group', groupId)
      return this.currentGroupData
    }

    this.switchingPromise = this.performOptimizedSwitch(groupId)
    
    try {
      const result = await this.switchingPromise
      console.log(`OptimizedGroupSwitcher: Switch completed in ${Date.now() - startTime}ms (${result.performance.queryTimeMs}ms DB)`)
      return result
    } finally {
      this.switchingPromise = null
    }
  }

  private async performOptimizedSwitch(groupId: string): Promise<OptimizedGroupData> {
    const response = await fetch('/api/groups/switch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ groupId })
    })

    if (!response.ok) {
      throw new Error(`Group switch failed: ${response.status} ${response.statusText}`)
    }

    const data: OptimizedGroupData = await response.json()
    
    // Cache the result
    this.currentGroupData = data
    
    // Store in localStorage for persistence (only in browser)
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedGroupId', groupId)
      localStorage.setItem('optimizedGroupData', JSON.stringify({
        ...data,
        cachedAt: Date.now()
      }))
      
      // Remember this as the last selected group
      rememberLastGroup(groupId)
    }

    return data
  }

  /**
   * Get cached group data without making API call
   */
  getCachedGroupData(): OptimizedGroupData | null {
    // Check memory cache first
    if (this.currentGroupData) {
      return this.currentGroupData
    }

    // Check localStorage cache only if we're in the browser
    if (typeof window === 'undefined') {
      return null
    }

    try {
      const cached = localStorage.getItem('optimizedGroupData')
      if (cached) {
        const parsedCache = JSON.parse(cached)
        const cacheAge = Date.now() - parsedCache.cachedAt
        
        // Use cache if less than 5 minutes old and has required structure
        if (cacheAge < 5 * 60 * 1000 && parsedCache.group && parsedCache.currentMember) {
          console.log('OptimizedGroupSwitcher: Using localStorage cache')
          // Ensure arrays exist with fallbacks
          const safeCache = {
            ...parsedCache,
            trips: parsedCache.trips || [],
            allMembers: parsedCache.allMembers || [],
            pointsOfInterest: parsedCache.pointsOfInterest || [],
            expensesSummary: parsedCache.expensesSummary || null
          }
          this.currentGroupData = safeCache
          return safeCache
        } else {
          console.log('OptimizedGroupSwitcher: Cache expired or invalid, clearing')
          localStorage.removeItem('optimizedGroupData')
        }
      }
    } catch (error) {
      console.warn('OptimizedGroupSwitcher: Failed to load cache', error)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('optimizedGroupData')
      }
    }

    return null
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    console.log('OptimizedGroupSwitcher: Clearing all cache')
    this.currentGroupData = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('optimizedGroupData')
      localStorage.removeItem('selectedGroupId')
    }
  }

  /**
   * Invalidate cache for current group (force refresh on next access)
   */
  invalidateCurrentGroup(): void {
    console.log('OptimizedGroupSwitcher: Invalidating current group cache')
    this.currentGroupData = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('optimizedGroupData')
    }
  }

  /**
   * Get performance metrics from last switch
   */
  getLastSwitchMetrics(): OptimizedGroupData['performance'] | null {
    return this.currentGroupData?.performance || null
  }
}

// Export singleton instance
export const optimizedGroupSwitcher = OptimizedGroupSwitcher.getInstance()

// Utility functions for components
export const switchToGroupOptimized = (groupId: string) => 
  optimizedGroupSwitcher.switchToGroup(groupId)

export const getCachedGroupData = () => 
  optimizedGroupSwitcher.getCachedGroupData()

export const clearGroupCache = () => 
  optimizedGroupSwitcher.clearCache()

/**
 * Remember the last selected group ID for OAuth re-login scenarios
 */
export function rememberLastGroup(groupId: string): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem('lastSelectedGroupId', groupId)
    localStorage.setItem('lastGroupSelectedAt', Date.now().toString())
  } catch (error) {
    console.error('Error remembering last group:', error)
  }
}

/**
 * Get the last selected group ID (valid for 24 hours)
 */
export function getLastSelectedGroupId(): string | null {
  if (typeof window === 'undefined') return null
  
  try {
    const groupId = localStorage.getItem('lastSelectedGroupId')
    const selectedAt = localStorage.getItem('lastGroupSelectedAt')
    
    if (!groupId || !selectedAt) return null
    
    // Check if the stored group ID is less than 24 hours old
    const age = Date.now() - parseInt(selectedAt, 10)
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
    
    if (age > TWENTY_FOUR_HOURS) {
      localStorage.removeItem('lastSelectedGroupId')
      localStorage.removeItem('lastGroupSelectedAt')
      return null
    }
    
    return groupId
  } catch (error) {
    console.error('Error getting last selected group:', error)
    return null
  }
}

/**
 * Clear the last selected group memory
 */
export function clearLastSelectedGroup(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem('lastSelectedGroupId')
    localStorage.removeItem('lastGroupSelectedAt')
  } catch (error) {
    console.error('Error clearing last selected group:', error)
  }
}

/**
 * Remember the last active trip for auto-redirect on login
 */
export function rememberLastTrip(tripId: string, groupId?: string): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem('lastActiveTripId', tripId)
    localStorage.setItem('lastTripActiveAt', Date.now().toString())
    if (groupId) {
      localStorage.setItem('lastActiveTripGroupId', groupId)
    }
  } catch (error) {
    console.error('Error remembering last active trip:', error)
  }
}

/**
 * Get the last active trip ID and group (valid for 7 days)
 */
export function getLastAccessedTrip(): { tripId: string; groupId?: string } | null {
  if (typeof window === 'undefined') return null
  
  try {
    const tripId = localStorage.getItem('lastActiveTripId')
    const activeAt = localStorage.getItem('lastTripActiveAt')
    const groupId = localStorage.getItem('lastActiveTripGroupId')
    
    if (!tripId || !activeAt) return null
    
    // Check if the stored trip ID is less than 7 days old (more persistent than groups)
    const age = Date.now() - parseInt(activeAt, 10)
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
    
    if (age > SEVEN_DAYS) {
      clearLastAccessedTrip()
      return null
    }
    
    return { tripId, groupId: groupId || undefined }
  } catch (error) {
    console.error('Error getting last active trip:', error)
    return null
  }
}

/**
 * Clear the last active trip memory
 */
export function clearLastAccessedTrip(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem('lastActiveTripId')
    localStorage.removeItem('lastTripActiveAt')
    localStorage.removeItem('lastActiveTripGroupId')
  } catch (error) {
    console.error('Error clearing last active trip:', error)
  }
}