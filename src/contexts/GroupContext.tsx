'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface Group {
  id: string
  name: string
  accessCode: string
  role: string
  memberCount: number
  tripCount: number
  recentTrips?: any[]
}

interface GroupMember {
  id: string
  travelerName: string
  role: string
  permissions: {
    read: boolean
    create: boolean
    modify: boolean
  }
}

interface GroupContextType {
  // Current selected group
  selectedGroup: Group | null
  selectedGroupMember: GroupMember | null
  
  // All available groups for the user
  availableGroups: Group[]
  
  // Loading states
  loading: boolean
  
  // Actions
  selectGroup: (groupId: string) => Promise<void>
  refreshGroups: () => Promise<void>
  updateSelectedGroupName: (newName: string) => void
  
  // Permissions helpers
  canEdit: boolean
  canCreate: boolean
  canModify: boolean
  isAdventurer: boolean
  
  // Events
  onGroupChange?: (newGroupId: string, oldGroupId?: string) => void
}

export const GroupContext = createContext<GroupContextType | undefined>(undefined)

interface GroupProviderProps {
  children: ReactNode
}

export function GroupProvider({ children }: GroupProviderProps) {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [selectedGroupMember, setSelectedGroupMember] = useState<GroupMember | null>(null)
  const [availableGroups, setAvailableGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  // Load available groups on mount
  useEffect(() => {
    refreshGroups()
  }, [])

  const refreshGroups = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/groups')
      if (response.ok) {
        const data = await response.json()
        const groups = data.groups || []
        setAvailableGroups(groups)
        
        // Check for stored group selection first, then auto-select first group
        const storedGroupId = localStorage.getItem('selectedGroupId')
        if (!selectedGroup && groups.length > 0) {
          let targetGroupId = groups[0].id // Default to first group
          
          // If we have a stored selection and it's valid, use that instead
          if (storedGroupId) {
            const storedGroupExists = groups.find((g: Group) => g.id === storedGroupId)
            if (storedGroupExists) {
              targetGroupId = storedGroupId
              console.log('GroupContext: Using stored group selection:', storedGroupId)
            } else {
              // Clear invalid stored group
              localStorage.removeItem('selectedGroupId')
              console.log('GroupContext: Cleared invalid stored group:', storedGroupId)
            }
          } else {
            console.log('GroupContext: No stored group, using first available group:', targetGroupId)
          }
          
          await selectGroupDirect(targetGroupId, groups)
        }
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }

  // Clear all caches when switching groups
  const clearAllCaches = async (newGroupId: string) => {
    console.log('GroupContext: Clearing all caches for group switch to:', newGroupId)
    
    // Clear React Query cache (group members, etc.)
    queryClient.clear()
    
    // Force browser to bypass cache for next requests
    if (typeof window !== 'undefined') {
      // Clear any stored cache timestamps
      const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('cache_'))
      cacheKeys.forEach(key => localStorage.removeItem(key))
    }
  }

  const selectGroupDirect = async (groupId: string, groups: Group[]) => {
    try {
      // Find the group in provided groups array
      const group = groups.find((g: Group) => g.id === groupId)
      if (!group) {
        console.error('Group not found in provided groups')
        return
      }

      // Clear all caches when switching groups (but not on initial load)
      if (selectedGroup && selectedGroup.id !== groupId) {
        await clearAllCaches(groupId)
      }

      // Get detailed group info including member permissions using the updated current endpoint
      const cacheBuster = Date.now()
      const response = await fetch(`/api/groups/current?groupId=${groupId}&t=${cacheBuster}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      })
      if (response.ok) {
        const data = await response.json()
        
        setSelectedGroup({
          id: data.group.id,
          name: data.group.name,
          accessCode: data.group.accessCode,
          role: data.role,
          memberCount: group.memberCount, // From available groups
          tripCount: group.tripCount // From available groups
        })

        if (data.currentMember) {
          setSelectedGroupMember({
            id: data.currentMember.id,
            travelerName: data.currentMember.name,
            role: data.currentMember.role,
            permissions: data.currentMember.permissions
          })
        }

        // Store selection in localStorage for persistence
        localStorage.setItem('selectedGroupId', groupId)
        
        console.log('GroupContext: Successfully selected group:', groupId, group.name)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to select group:')
        console.error('Status:', response.status)
        console.error('Status Text:', response.statusText)
        console.error('Error Data:', errorData)
        console.error('Group ID:', groupId)
        
        // Also log the debug info if available
        if (errorData.debug) {
          console.error('Debug Info:', errorData.debug)
        }
      }
    } catch (error) {
      console.error('Error selecting group:', error)
    }
  }

  const selectGroup = async (groupId: string) => {
    // Ensure we have available groups before selecting
    if (availableGroups.length === 0) {
      console.warn('No available groups loaded yet, waiting...')
      return
    }
    await selectGroupDirect(groupId, availableGroups)
  }

  const updateSelectedGroupName = (newName: string) => {
    if (selectedGroup) {
      setSelectedGroup({ ...selectedGroup, name: newName })
      
      // Also update in available groups
      setAvailableGroups(groups => 
        groups.map(g => g.id === selectedGroup.id ? { ...g, name: newName } : g)
      )
    }
  }

  // Permission helpers
  const canEdit = selectedGroupMember?.role === 'adventurer'
  const canCreate = selectedGroupMember?.permissions?.create ?? false
  const canModify = selectedGroupMember?.permissions?.modify ?? false
  const isAdventurer = selectedGroupMember?.role === 'adventurer'


  const value: GroupContextType = {
    selectedGroup,
    selectedGroupMember,
    availableGroups,
    loading,
    selectGroup,
    refreshGroups,
    updateSelectedGroupName,
    canEdit,
    canCreate,
    canModify,
    isAdventurer
  }

  return (
    <GroupContext.Provider value={value}>
      {children}
    </GroupContext.Provider>
  )
}

export function useGroup() {
  const context = useContext(GroupContext)
  if (context === undefined) {
    throw new Error('useGroup must be used within a GroupProvider')
  }
  return context
}