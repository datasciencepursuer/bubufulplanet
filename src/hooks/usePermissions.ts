'use client'

import { useState, useEffect } from 'react'
import { 
  PermissionContext, 
  hasPermission, 
  canCreate, 
  canModify, 
  isAdventurer 
} from '@/lib/permissions'

export function usePermissions() {
  const [permissionContext, setPermissionContext] = useState<PermissionContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchPermissions()
  }, [])

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/groups/current')
      if (response.ok) {
        const data = await response.json()
        if (data.currentMember) {
          setPermissionContext({
            role: data.currentMember.role,
            permissions: data.currentMember.permissions
          })
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isLoading,
    permissionContext,
    canCreate: () => canCreate(permissionContext),
    canModify: () => canModify(permissionContext),
    isAdventurer: () => isAdventurer(permissionContext),
    hasPermission: (permission: keyof PermissionContext['permissions']) => 
      hasPermission(permissionContext, permission),
    refresh: fetchPermissions
  }
}