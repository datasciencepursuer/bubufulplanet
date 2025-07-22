'use client'

import { createContext, useContext, useCallback, ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { GroupMember } from '@prisma/client'

interface DataCacheContextType {
  groupMembers: GroupMember[]
  isLoadingMembers: boolean
  membersError: Error | null
  refreshGroupMembers: () => Promise<void>
  invalidateGroupMembers: () => void
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined)

export function useDataCache() {
  const context = useContext(DataCacheContext)
  if (context === undefined) {
    throw new Error('useDataCache must be used within a DataCacheProvider')
  }
  return context
}

// API function for fetching group members
async function fetchGroupMembers(): Promise<GroupMember[]> {
  const response = await fetch('/api/groups/members')
  if (!response.ok) {
    throw new Error('Failed to fetch group members')
  }
  const data = await response.json()
  return data.members || []
}

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  // Use React Query to manage group members cache
  const {
    data: groupMembers = [],
    isLoading: isLoadingMembers,
    error: membersError,
    refetch: refetchMembers,
  } = useQuery({
    queryKey: ['groupMembers'],
    queryFn: fetchGroupMembers,
    staleTime: 10 * 60 * 1000, // 10 minutes - group members change infrequently
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: (failureCount, error: any) => {
      // Don't retry if unauthorized
      if (error?.status === 401 || error?.status === 403) {
        return false
      }
      return failureCount < 2
    },
  })

  const refreshGroupMembers = useCallback(async () => {
    await refetchMembers()
  }, [refetchMembers])

  const invalidateGroupMembers = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['groupMembers'] })
  }, [queryClient])

  const value: DataCacheContextType = {
    groupMembers,
    isLoadingMembers,
    membersError: membersError as Error | null,
    refreshGroupMembers,
    invalidateGroupMembers,
  }

  return (
    <DataCacheContext.Provider value={value}>
      {children}
    </DataCacheContext.Provider>
  )
}