'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getCachedGroupData } from '@/lib/optimizedGroupSwitch'

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
  switching: boolean
  
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
  const [switching, setSwitching] = useState(false)
  const queryClient = useQueryClient()

  // Load available groups on mount, but respect optimized group selection timing
  useEffect(() => {
    const initializeGroups = async () => {
      // Check if we're in the middle of an optimized group switch
      const optimizedSwitchComplete = localStorage.getItem('optimizedSwitchComplete') === 'true'
      const groupSelectionInProgress = localStorage.getItem('groupSelectionInProgress') === 'true'
      
      if (groupSelectionInProgress || optimizedSwitchComplete) {
        console.log('GroupContext: Optimized group switch detected, waiting for completion...')
        
        // Wait a bit longer for the optimized switch to fully complete
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      await refreshGroups()
    }
    
    initializeGroups()
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
        const isFromGroupSelection = localStorage.getItem('groupSelectionInProgress') === 'true'
        const validationData = localStorage.getItem('groupValidationData')
        const optimizedSwitchComplete = localStorage.getItem('optimizedSwitchComplete') === 'true'
        
        console.log('GroupContext: Current state:', {
          selectedGroup: selectedGroup?.id || 'none',
          storedGroupId,
          isFromGroupSelection,
          optimizedSwitchComplete,
          availableGroups: groups.map((g: Group) => ({ id: g.id, name: g.name }))
        })
        
        if (!selectedGroup && groups.length > 0) {
          let targetGroupId = groups[0].id // Default to first group
          
          // If we have a stored selection and it's valid, use that instead
          if (storedGroupId) {
            const storedGroupExists = groups.find((g: Group) => g.id === storedGroupId)
            console.log('GroupContext: Checking stored group:', {
              storedGroupId,
              availableGroupIds: groups.map((g: Group) => g.id),
              storedGroupExists: !!storedGroupExists
            })
            
            if (storedGroupExists) {
              targetGroupId = storedGroupId
              console.log('GroupContext: ✅ Using stored group selection:', storedGroupId, isFromGroupSelection ? '(from group selection)' : '(from cache)')
            } else {
              // For optimized switches, don't clear the data immediately - the group might be valid
              if (optimizedSwitchComplete) {
                console.log('GroupContext: ⚠️ Stored group not found in available groups, but optimized switch is complete. Keeping stored ID.')
                targetGroupId = storedGroupId // Use it anyway since optimized switch validated it
              } else {
                // Clear invalid stored group only if not from optimized switch
                localStorage.removeItem('selectedGroupId')
                localStorage.removeItem('groupSelectionInProgress')
                localStorage.removeItem('groupValidationData')
                console.log('GroupContext: ❌ Cleared invalid stored group:', storedGroupId)
              }
            }
          } else {
            console.log('GroupContext: No stored group, using first available group:', targetGroupId)
          }
          
          // Check for optimized group data first
          const optimizedData = getCachedGroupData()
          const isOptimizedSwitch = localStorage.getItem('optimizedSwitchComplete') === 'true'
          
          console.log('GroupContext: Optimization check:', {
            optimizedData: optimizedData ? {
              groupId: optimizedData.group?.id,
              groupName: optimizedData.group?.name
            } : 'null',
            isOptimizedSwitch,
            targetGroupId,
            storedGroupId
          })
          
          if ((isOptimizedSwitch || optimizedSwitchComplete) && optimizedData) {
            console.log('GroupContext: Using optimized group data:', optimizedData.group.name)
            
            // For optimized switches, trust the optimized data's group ID over calculated targetGroupId
            targetGroupId = optimizedData.group.id
            
            // Set the group data directly from optimized response
            setSelectedGroup({
              id: optimizedData.group.id,
              name: optimizedData.group.name,
              accessCode: optimizedData.group.accessCode,
              role: optimizedData.currentMember.role,
              memberCount: optimizedData.allMembers?.length || 0,
              tripCount: optimizedData.trips?.length || 0
            })

            if (optimizedData.currentMember) {
              setSelectedGroupMember({
                id: optimizedData.currentMember.id,
                travelerName: optimizedData.currentMember.name,
                role: optimizedData.currentMember.role,
                permissions: optimizedData.currentMember.permissions
              })
            }

            // Store selection in localStorage for persistence
            localStorage.setItem('selectedGroupId', optimizedData.group.id)
            
            // Clear the flags
            localStorage.removeItem('groupSelectionInProgress')
            localStorage.removeItem('groupValidationData')
            
            console.log('GroupContext: Optimized group loaded successfully')
          } else if (isFromGroupSelection && validationData) {
            try {
              const parsedValidationData = JSON.parse(validationData)
              console.log('GroupContext: Using pre-validated group data:', parsedValidationData.group.name)
              
              // Set the group data directly from validation
              setSelectedGroup({
                id: parsedValidationData.group.id,
                name: parsedValidationData.group.name,
                accessCode: parsedValidationData.group.accessCode,
                role: parsedValidationData.role,
                memberCount: groups.find((g: Group) => g.id === parsedValidationData.group.id)?.memberCount || 0,
                tripCount: groups.find((g: Group) => g.id === parsedValidationData.group.id)?.tripCount || 0
              })

              if (parsedValidationData.currentMember) {
                setSelectedGroupMember({
                  id: parsedValidationData.currentMember.id,
                  travelerName: parsedValidationData.currentMember.name,
                  role: parsedValidationData.currentMember.role,
                  permissions: parsedValidationData.currentMember.permissions
                })
              }

              // Store selection in localStorage for persistence
              localStorage.setItem('selectedGroupId', targetGroupId)
              
              // Clear the validation flags
              localStorage.removeItem('groupSelectionInProgress')
              localStorage.removeItem('groupValidationData')
              
              console.log('GroupContext: Pre-validated group loaded successfully')
            } catch (error) {
              console.error('GroupContext: Failed to parse validation data, falling back to API call')
              await selectGroupDirect(targetGroupId, groups)
            }
          } else {
            // Clear the group selection flag
            if (isFromGroupSelection) {
              localStorage.removeItem('groupSelectionInProgress')
              localStorage.removeItem('groupValidationData')
            }
            
            await selectGroupDirect(targetGroupId, groups)
          }
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
    await queryClient.clear()
    
    // Force browser to bypass cache for next requests
    if (typeof window !== 'undefined') {
      // Clear any stored cache timestamps
      const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('cache_'))
      cacheKeys.forEach(key => localStorage.removeItem(key))
      
      // Clear session storage that might contain cached data
      const sessionCacheKeys = Object.keys(sessionStorage).filter(key => key.startsWith('cache_'))
      sessionCacheKeys.forEach(key => sessionStorage.removeItem(key))
      
      // Dispatch custom event to notify other components to refresh
      window.dispatchEvent(new CustomEvent('groupSwitched', { 
        detail: { newGroupId, timestamp: Date.now() } 
      }))
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

      const isGroupSwitch = selectedGroup && selectedGroup.id !== groupId

      // Set switching state immediately when switching groups
      if (isGroupSwitch) {
        setSwitching(true)
        console.log('GroupContext: Starting group switch from', selectedGroup.id, 'to', groupId)
      }

      // Clear all caches when switching groups (but not on initial load)
      if (isGroupSwitch) {
        await clearAllCaches(groupId)
      }

      // Get detailed group info including member permissions using the updated current endpoint
      const cacheBuster = Date.now()
      const response = await fetch(`/api/groups/current?groupId=${groupId}&t=${cacheBuster}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
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
        
        // Add a small delay to ensure all cache clearing is complete
        if (isGroupSwitch) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
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
    } finally {
      // Always clear switching state
      setSwitching(false)
    }
  }

  const selectGroup = async (groupId: string) => {
    console.log('GroupContext.selectGroup called with:', groupId)
    
    // Ensure we have available groups before selecting
    if (availableGroups.length === 0) {
      console.warn('GroupContext: No available groups loaded yet, refreshing...')
      await refreshGroups()
      if (availableGroups.length === 0) {
        console.error('GroupContext: Still no groups after refresh')
        return
      }
    }
    
    // Store the selection in localStorage for persistence
    localStorage.setItem('selectedGroupId', groupId)
    
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
    switching,
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