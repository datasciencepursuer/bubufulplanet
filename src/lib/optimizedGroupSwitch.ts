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
    
    // Store in localStorage for persistence
    localStorage.setItem('selectedGroupId', groupId)
    localStorage.setItem('optimizedGroupData', JSON.stringify({
      ...data,
      cachedAt: Date.now()
    }))

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

    // Check localStorage cache
    try {
      const cached = localStorage.getItem('optimizedGroupData')
      if (cached) {
        const parsedCache = JSON.parse(cached)
        const cacheAge = Date.now() - parsedCache.cachedAt
        
        // Use cache if less than 5 minutes old
        if (cacheAge < 5 * 60 * 1000) {
          console.log('OptimizedGroupSwitcher: Using localStorage cache')
          this.currentGroupData = parsedCache
          return parsedCache
        } else {
          console.log('OptimizedGroupSwitcher: Cache expired, clearing')
          localStorage.removeItem('optimizedGroupData')
        }
      }
    } catch (error) {
      console.warn('OptimizedGroupSwitcher: Failed to load cache', error)
      localStorage.removeItem('optimizedGroupData')
    }

    return null
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    console.log('OptimizedGroupSwitcher: Clearing all cache')
    this.currentGroupData = null
    localStorage.removeItem('optimizedGroupData')
    localStorage.removeItem('selectedGroupId')
  }

  /**
   * Invalidate cache for current group (force refresh on next access)
   */
  invalidateCurrentGroup(): void {
    console.log('OptimizedGroupSwitcher: Invalidating current group cache')
    this.currentGroupData = null
    localStorage.removeItem('optimizedGroupData')
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