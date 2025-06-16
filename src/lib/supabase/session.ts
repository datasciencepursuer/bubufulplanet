import { 
  withUnifiedSessionContext, 
  requireUnifiedPermission,
  type UnifiedSessionContext 
} from '@/lib/unified-session'

// Re-export unified types and functions for backward compatibility

// Legacy type alias for backward compatibility
export type SessionContext = UnifiedSessionContext

// Legacy function aliases for backward compatibility
export const withSessionContext = withUnifiedSessionContext
export const requirePermission = requireUnifiedPermission

// Deprecated - use unified session management instead
export function withGroupFilter(query: any, groupId: string) {
  console.warn('withGroupFilter is deprecated - RLS handles filtering automatically')
  return query.eq('group_id', groupId)
}