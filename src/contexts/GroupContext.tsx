'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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
}

const GroupContext = createContext<GroupContextType | undefined>(undefined)

interface GroupProviderProps {
  children: ReactNode
}

export function GroupProvider({ children }: GroupProviderProps) {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [selectedGroupMember, setSelectedGroupMember] = useState<GroupMember | null>(null)
  const [availableGroups, setAvailableGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

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
        
        // Auto-select first group if none selected and groups exist
        if (!selectedGroup && groups.length > 0) {
          await selectGroupDirect(groups[0].id, groups)
        }
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectGroupDirect = async (groupId: string, groups: Group[]) => {
    try {
      // Find the group in provided groups array
      const group = groups.find(g => g.id === groupId)
      if (!group) {
        console.error('Group not found in provided groups')
        return
      }

      // Get detailed group info including member permissions using the updated current endpoint
      const response = await fetch(`/api/groups/current?groupId=${groupId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
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
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to select group:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          groupId
        })
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

  // Restore selected group from localStorage when groups are loaded
  useEffect(() => {
    const storedGroupId = localStorage.getItem('selectedGroupId')
    if (storedGroupId && availableGroups.length > 0 && !selectedGroup) {
      const groupExists = availableGroups.find(g => g.id === storedGroupId)
      if (groupExists) {
        selectGroup(storedGroupId)
      } else {
        // Clear invalid stored group
        localStorage.removeItem('selectedGroupId')
      }
    }
  }, [availableGroups])

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