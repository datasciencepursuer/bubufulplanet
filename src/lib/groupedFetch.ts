// Helper function for making API calls with group context
export async function groupedFetch(
  url: string, 
  selectedGroupId: string | null = null,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  // Add group ID to headers if available
  if (selectedGroupId) {
    headers['x-group-id'] = selectedGroupId
  }

  return fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  })
}

// React hook version that uses GroupContext
import { useContext } from 'react'
import { GroupContext } from '@/contexts/GroupContext'

export function useGroupedFetch() {
  const context = useContext(GroupContext)
  
  if (!context) {
    throw new Error('useGroupedFetch must be used within a GroupProvider')
  }

  const { selectedGroup } = context

  return (url: string, options: RequestInit = {}) => {
    return groupedFetch(url, selectedGroup?.id || null, options)
  }
}