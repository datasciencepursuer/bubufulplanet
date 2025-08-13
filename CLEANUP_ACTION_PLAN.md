# Codebase Cleanup Action Plan

## 1. Environment Files Consolidation

### Current State:
- `.env` - Contains only database URLs (4 lines)
- `.env.local` - Contains all environment variables including duplicates (16 lines)

### ACTION REQUIRED:
```bash
# Step 1: Keep only .env.local (it has all variables)
rm .env

# Step 2: Rename .env.local to .env
mv .env.local .env

# Step 3: Update .gitignore to ignore .env
echo ".env" >> .gitignore
```

## 2. Remove Legacy Authentication System

### Files to DELETE (Old device/group-based auth):
```bash
# Delete device session related files
rm src/lib/device-fingerprint.ts
rm src/lib/unified-session.ts
rm src/lib/unified-session-client.ts
rm src/lib/session-config.ts
rm src/hooks/useDeviceSession.ts
rm src/components/DeviceSessionDemo.tsx
rm src/components/AutoLoginButton.tsx

# Delete old API routes for device sessions
rm -rf src/app/api/device-sessions/
rm -rf src/app/api/auth/logout/
rm -rf src/app/api/auth/verify-code/

# Delete old group creation/join routes (replaced by Supabase auth)
rm -rf src/app/api/groups/create/
rm -rf src/app/api/groups/join/
```

## 3. Update API Routes to Use Supabase Auth

### Files to MODIFY:
Replace `validateUnifiedSession` and `withUnifiedSessionContext` with Supabase auth checks.

**Pattern to replace in all API routes:**
```typescript
// OLD CODE TO REMOVE:
import { validateUnifiedSession, withUnifiedSessionContext } from '@/lib/unified-session'

// NEW CODE TO ADD:
import { createClient } from '@/utils/supabase/server'

// In each route handler, replace:
const validation = await validateUnifiedSession()
if (!validation.isValid) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// With:
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Files requiring this update:
- src/app/api/expenses/[id]/route.ts
- src/app/api/expenses/route.ts
- src/app/api/expenses/summary/route.ts
- src/app/api/expenses/personal-summary/route.ts
- src/app/api/expenses/all/route.ts
- src/app/api/events/route.ts
- src/app/api/events/[id]/route.ts
- src/app/api/events/expenses/route.ts
- src/app/api/trips/[id]/days/route.ts
- src/app/api/trips/[id]/route.ts
- src/app/api/trips/route.ts
- src/app/api/trips/[id]/expenses/route.ts
- src/app/api/external-participants/route.ts
- src/app/api/points-of-interest/route.ts

## 4. Remove Unused Components

### Files to DELETE:
```bash
# Remove old access code confirmation (replaced by OAuth)
rm src/components/AccessCodeConfirmation.tsx

# Remove components that reference device sessions
# First check if Navbar.tsx uses device sessions, if yes, update it
# Check src/components/Navbar.tsx and remove device session references
```

## 5. Database Schema Cleanup

### Tables to consider removing (via migration):
```sql
-- These tables are no longer needed with OAuth-only auth:
DROP TABLE IF EXISTS "device_sessions";
DROP TABLE IF EXISTS "devices";
DROP TABLE IF EXISTS "cleanup_log";
```

### Create migration file:
```bash
pnpm prisma migrate dev --name cleanup_legacy_auth_tables
```

## 6. Update Prisma Schema

### Remove from schema.prisma:
- Model `Device`
- Model `DeviceSession` 
- Model `CleanupLog`
- Any relations to these models

## 7. Clean up app/app/page.tsx

### Remove imports and code related to:
- `useDeviceSession` hook
- `logout` function from device sessions
- Replace with Supabase auth logout

## 8. Update Package Dependencies

### Check and remove if unused:
```bash
# After cleanup, check for unused packages
pnpm list
# Consider removing any packages only used by deleted code
```

## 9. Update Documentation

### Files to UPDATE:
- CLAUDE.md - Remove references to device sessions, update to reflect OAuth-only auth
- README.md (if exists) - Update authentication documentation

## 10. Final Steps

### After all changes:
```bash
# 1. Generate new Prisma client
pnpm prisma generate

# 2. Run type checking
pnpm tsc --noEmit

# 3. Test the application
pnpm dev

# 4. Run any linting
pnpm lint

# 5. Commit changes
git add -A
git commit -m "refactor: Remove legacy auth system, consolidate to OAuth-only"
```

## Summary of Benefits
- **Removed ~15+ files** of legacy authentication code
- **Simplified API routes** - all use same Supabase auth pattern
- **Cleaner database** - removed unused tables
- **Single auth source** - OAuth only via Supabase
- **Consolidated env files** - single .env file
- **Reduced complexity** - no device fingerprinting or session management

## IMPORTANT NOTES:
1. **BACKUP FIRST**: Create a backup branch before starting cleanup
2. **TEST THOROUGHLY**: After each major deletion, test the app
3. **CHECK IMPORTS**: Use TypeScript compiler to find broken imports after deletions
4. **ENVIRONMENT VARIABLES**: Ensure production env vars are updated to match new structure