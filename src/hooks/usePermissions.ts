'use client'

import { useContext } from 'react'
import { 
  PermissionContext, 
  hasPermission, 
  canCreate, 
  canModify, 
  isAdventurer 
} from '@/lib/permissions'
import { GroupContext } from '@/contexts/GroupContext'

export function usePermissions() {
  const context = useContext(GroupContext)
  
  if (!context) {
    throw new Error('usePermissions must be used within a GroupProvider')
  }

  const { selectedGroupMember, loading } = context

  const permissionContext: PermissionContext | null = selectedGroupMember ? {
    role: selectedGroupMember.role,
    permissions: selectedGroupMember.permissions
  } : null

  return {
    isLoading: loading,
    permissionContext,
    canCreate: () => canCreate(permissionContext),
    canModify: () => canModify(permissionContext),
    isAdventurer: () => isAdventurer(permissionContext),
    hasPermission: (permission: keyof PermissionContext['permissions']) => 
      hasPermission(permissionContext, permission)
  }
}