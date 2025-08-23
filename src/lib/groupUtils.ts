// Lightweight utilities to replace GroupContext for optimized switches

import { getCachedGroupData } from '@/lib/optimizedGroupSwitch'

export interface Group {
  id: string
  name: string
  accessCode: string
  role: string
  memberCount: number
  tripCount: number
  recentTrips?: any[]
}

export interface GroupMember {
  id: string
  travelerName: string
  role: string
  permissions: {
    read: boolean
    create: boolean
    modify: boolean
  }
}

/**
 * Get current group and member info from optimized data
 */
export function useOptimizedGroup() {
  const optimizedData = getCachedGroupData()
  
  if (!optimizedData) {
    return {
      selectedGroup: null,
      selectedGroupMember: null,
      isLoading: true,
      canEdit: false,
      canCreate: false,
      canModify: false,
      isAdventurer: false
    }
  }

  const selectedGroup: Group = {
    id: optimizedData.group.id,
    name: optimizedData.group.name,
    accessCode: optimizedData.group.accessCode,
    role: optimizedData.currentMember.role,
    memberCount: optimizedData.allMembers?.length || 0,
    tripCount: optimizedData.trips?.length || 0,
    recentTrips: optimizedData.trips || []
  }

  const selectedGroupMember: GroupMember = {
    id: optimizedData.currentMember.id,
    travelerName: optimizedData.currentMember.name,
    role: optimizedData.currentMember.role,
    permissions: optimizedData.currentMember.permissions
  }

  // Permission helpers
  const isAdventurer = selectedGroupMember.role === 'adventurer'
  const canEdit = isAdventurer
  const canCreate = selectedGroupMember.permissions?.create ?? false
  const canModify = selectedGroupMember.permissions?.modify ?? false

  return {
    selectedGroup,
    selectedGroupMember,
    isLoading: false,
    canEdit,
    canCreate,
    canModify,
    isAdventurer
  }
}

/**
 * Simple grouped fetch utility using optimized data
 */
export function createGroupedFetch() {
  const optimizedData = getCachedGroupData()
  
  return async (url: string, options: RequestInit = {}, bustCache: boolean = false) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    // Add group ID to headers if available
    if (optimizedData?.group.id) {
      headers['x-group-id'] = optimizedData.group.id
    }

    // Add cache busting if requested
    let finalUrl = url
    if (bustCache) {
      const separator = url.includes('?') ? '&' : '?'
      finalUrl = `${url}${separator}t=${Date.now()}`
      headers['Cache-Control'] = 'no-cache'
    }

    return fetch(finalUrl, {
      credentials: 'include',
      cache: bustCache ? 'no-store' : options.cache,
      ...options,
      headers,
    })
  }
}

/**
 * Update group name in localStorage cache
 */
export function updateGroupName(newName: string) {
  const optimizedData = getCachedGroupData()
  if (optimizedData) {
    const updatedData = {
      ...optimizedData,
      group: {
        ...optimizedData.group,
        name: newName
      }
    }
    localStorage.setItem('optimizedGroupData', JSON.stringify({
      ...updatedData,
      cachedAt: Date.now()
    }))
  }
}