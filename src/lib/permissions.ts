// Permission checking utilities

export interface UserPermissions {
  read: boolean
  create: boolean
  modify: boolean
}

export interface PermissionContext {
  role: string
  permissions: UserPermissions
}

// Check if user has specific permission
export function hasPermission(
  context: PermissionContext | null,
  permission: keyof UserPermissions
): boolean {
  if (!context) return false
  
  // Adventurers always have all permissions
  if (context.role === 'adventurer') return true
  
  // Party members check their specific permissions
  return context.permissions[permission] === true
}

// Check if user can create items (trips, events, etc.)
export function canCreate(context: PermissionContext | null): boolean {
  return hasPermission(context, 'create')
}

// Check if user can modify items (edit, delete)
export function canModify(context: PermissionContext | null): boolean {
  return hasPermission(context, 'modify')
}

// Check if user can read items (always true for authenticated users)
export function canRead(context: PermissionContext | null): boolean {
  return hasPermission(context, 'read')
}

// Check if user is an adventurer
export function isAdventurer(context: PermissionContext | null): boolean {
  return context?.role === 'adventurer'
}

// Get permission display text
export function getPermissionDisplay(permissions: UserPermissions): string {
  const perms = []
  if (permissions.read) perms.push('View')
  if (permissions.create) perms.push('Create')
  if (permissions.modify) perms.push('Edit/Delete')
  return perms.join(', ')
}

// Get role display text
export function getRoleDisplay(role: string): string {
  return role === 'adventurer' ? 'Adventurer' : 'Party Member'
}