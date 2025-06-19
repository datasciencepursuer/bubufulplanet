# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 vacation planning application with TypeScript, Tailwind CSS, and Prisma + PostgreSQL. Features include group-based trip planning with calendar views, day-by-day itineraries, expense tracking, and device session management for seamless authentication.

## Development Commands

```bash
# Core development
pnpm run dev         # Start development server (http://localhost:3000)
pnpm run build       # Build for production (includes prisma generate)
pnpm start           # Run production server
pnpm run lint        # Run ESLint with Next.js strict configuration

# Database management
pnpm run db:migrate  # Deploy Prisma migrations
pnpm run db:generate # Generate Prisma client
pnpm run db:reset    # Reset database with fresh migrations
pnpm run db:seed     # Run database seeding
pnpm prisma migrate dev --name <name>  # Create new migration

# Maintenance & testing scripts
pnpm run cleanup:sessions         # Run device session cleanup manually
pnpm run test:session-extension   # Test session extension functionality
pnpm run test:logout             # Test logout functionality
pnpm run test:final-day          # Test final day clickability fix
```

## Architecture

### Database Structure (Prisma + PostgreSQL)

Hierarchical data model with group-based access control:
- `travel_groups` → `group_members` + `trips` + `device_sessions`
- `trips` → `trip_days` → `events` → `expenses`
- `devices` → `device_sessions` (consolidates device fingerprints)
- `packing_items` (linked to trips)
- `cleanup_log` (tracks maintenance operations)

**Key Database Features:**
- Composite indexes for performance (e.g., `trip_days` on `[tripId, dayNumber]`)
- Device session consolidation with lifespan management
- Automatic cleanup of expired sessions via cron job

### Authentication & Session Management

**Group-Based System:**
- No traditional user accounts - authentication via travel groups
- Users create/join groups using unique access codes
- Travelers identified by name within groups

**Device Session Features:**
- Browser fingerprinting for automatic re-authentication
- Session lifespans: 90 days (remember_device), extendable on login
- One session per device per group (consolidation)
- Automatic cleanup of expired/idle sessions
- Optional local data clearing on logout

**Key Files:**
- `src/lib/device-fingerprint.ts` - Device fingerprint generation
- `src/hooks/useDeviceSession.ts` - React hook for device sessions
- `src/lib/unified-session.ts` - Server-side session management
- `src/lib/session-config.ts` - Session lifespan configuration

### Date & Time Management

**Timezone-Agnostic Approach:**
- All dates treated as absolute calendar dates using UTC
- `createAbsoluteDate()` - Creates timezone-independent dates
- `createAbsoluteDateRange()` - Generates inclusive date ranges
- `normalizeDate()` - Converts dates to YYYY-MM-DD format using UTC methods

**Critical Fix Applied:**
- Final day of trips now properly clickable (UTC normalization fix)
- All date comparisons use consistent UTC-based approach

### API Pattern

```typescript
// Standard API route pattern
import { validateUnifiedSession } from '@/lib/unified-session'
import { prisma } from '@/lib/prisma'

const validation = await validateUnifiedSession()
if (!validation.isValid) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// Operations automatically scoped to group
const trips = await prisma.trip.findMany({
  where: { groupId: validation.context!.groupId },
  orderBy: { createdAt: 'desc' }
})
```

### Key Components

**Calendar System:**
- `WeeklyCalendarView.tsx` - Time-slot grid (6 AM-10 PM) with drag selection
- `AppMonthlyCalendar.tsx` - Trip creation via date range selection
- `DailyCalendarView.tsx` - Single day detailed view

**Event Management:**
- `EventModal.tsx` - Create/edit events with embedded expense tracking
- `PersistentEventModal.tsx` - Wrapper for consistent modal behavior
- Events support multiple expenses per event

**Trip Management:**
- `TripForm.tsx` - Create/edit trips with date confirmation
- Automatic `trip_days` generation for date ranges
- Trip dates editable post-creation

## Environment Variables

Required in `.env.local`:
```
DATABASE_URL=                    # PostgreSQL connection string
DIRECT_DATABASE_URL=             # Direct database URL for migrations
NEXT_PUBLIC_SUPABASE_URL=        # Supabase URL (legacy, being phased out)
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key (legacy)
SUPABASE_SERVICE_ROLE_KEY=       # Service role key (legacy)
```

## Production Deployment

**Coolify Cron Setup:**
- Configure cleanup script: `cd /app && npm run cleanup:sessions`
- Recommended schedule: `0 2 * * *` (daily at 2 AM)
- Uses same environment as webapp

**Database Indexes:**
- Composite index on `trip_days(tripId, dayNumber)` for fast lookups
- Event index on `events(dayId, startSlot)` for calendar queries
- Device session indexes for efficient cleanup operations

## Recent Improvements

1. **Device Session Optimization:**
   - Consolidated device storage (60-70% reduction)
   - Session lifespan extension on login
   - Automatic cleanup via Coolify cron
   - Remember device for 3 months (extendable)

2. **Date Handling Fixes:**
   - Final day of trips now clickable
   - Timezone-agnostic date operations
   - Consistent UTC-based normalization

3. **Trip Management Enhancements:**
   - Editable trip dates post-creation
   - Date confirmation during creation
   - Proper duration calculation (inclusive)

4. **Session Features:**
   - Complete logout removes all device sessions
   - Optional local data clearing for privacy
   - Session extension on each login

## Development Patterns

- **Prisma-First Database Access**: All DB operations through Prisma client
- **Group-Scoped Operations**: Data automatically filtered by travel group
- **Modal State Management**: Parent components manage modal state
- **Drag-to-Select Calendar**: Custom implementation in weekly view
- **Expense Integration**: Tightly coupled with events
- **Permission System**: Role-based (adventurer vs party member)

## Testing Utilities

Located in `scripts/` directory:
- `test-session-extension.js` - Verify session lifespan extension
- `test-logout-functionality.js` - Ensure complete session removal
- `test-final-day-clickability.js` - Confirm final day fix
- `cleanup-device-sessions.js` - Manual cleanup execution
- `check-cleanup-logs.js` - Monitor cleanup operations

## Missing Features (Schema Ready)

- **Packing Lists**: `packing_items` table exists, needs implementation
- **Weather Integration**: Event schema supports weather field
- **Loadout Management**: Event schema supports loadout field