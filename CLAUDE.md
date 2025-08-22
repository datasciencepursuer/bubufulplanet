# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 vacation planning application with TypeScript, Tailwind CSS, and Prisma + PostgreSQL. Features include group-based trip planning with calendar views, day-by-day itineraries, expense tracking, and OAuth-based authentication via Supabase.

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
pnpm run test:final-day          # Test final day clickability fix
```

## Architecture

### Database Structure (Prisma + PostgreSQL)

Hierarchical data model with OAuth and group-based access control:
- `travel_groups` → `group_members` + `trips` + `user_groups`
- `trips` → `trip_days` → `events` → `expenses`
- `user_groups` (links Supabase users to travel groups)
- `packing_items` (linked to trips)

**Key Database Features:**
- Composite indexes for performance (e.g., `trip_days` on `[tripId, dayNumber]`)
- OAuth-based authentication via Supabase
- Many-to-many user-group relationships via `user_groups` table

### Authentication & Session Management

**OAuth-Only Authentication:**
- Supabase Auth with Google/GitHub OAuth providers
- Users authenticate via OAuth and are linked to travel groups
- Email-based invitations for group membership
- Support for multiple groups per user

**Authentication Flow:**
- OAuth sign-in via Supabase (Google/GitHub)
- Automatic linking of pending email invitations
- Group membership via `user_groups` junction table
- Session management handled by Supabase

**Key Files:**
- `src/utils/supabase/client.ts` - Browser-side Supabase client
- `src/utils/supabase/server.ts` - Server-side Supabase client
- `src/components/auth/OAuthSignIn.tsx` - OAuth sign-in component
- `src/app/auth/callback/route.ts` - OAuth callback handler

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
// Standard API route pattern with Supabase Auth
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// Get user's current group
const userGroup = await prisma.userGroup.findFirst({
  where: { userId: user.id },
  include: { group: true }
})

if (!userGroup) {
  return NextResponse.json({ error: 'No group found' }, { status: 404 })
}

// Operations automatically scoped to group
const trips = await prisma.trip.findMany({
  where: { groupId: userGroup.groupId },
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

Required in `.env`:
```
DATABASE_URL=                    # PostgreSQL connection string
DIRECT_DATABASE_URL=             # Direct database URL for migrations
NEXT_PUBLIC_SUPABASE_URL=        # Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase publishable key (sb_publishable_...)
SUPABASE_SERVICE_ROLE_KEY=       # Supabase secret key (placeholder: YOUR_SECRET_KEY_HERE)
```

## Production Deployment

**Environment Variables Required:**
```
DATABASE_URL=                    # PostgreSQL connection string
DIRECT_DATABASE_URL=             # Direct database URL for migrations
NEXT_PUBLIC_SUPABASE_URL=        # Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase publishable key (sb_publishable_...)
SUPABASE_SERVICE_ROLE_KEY=       # Supabase secret key (placeholder: YOUR_SECRET_KEY_HERE)
```

**Database Indexes:**
- Composite index on `trip_days(tripId, dayNumber)` for fast lookups
- Event index on `events(dayId, startSlot)` for calendar queries
- User-group indexes for efficient OAuth-based access control

## Recent Improvements

1. **OAuth Authentication System:**
   - Migrated to Supabase Auth with Google/GitHub OAuth
   - Email-based group invitations and user linking
   - Support for multiple groups per user
   - Eliminated legacy device session system

2. **Date Handling Fixes:**
   - Final day of trips now clickable
   - Timezone-agnostic date operations
   - Consistent UTC-based normalization

3. **Trip Management Enhancements:**
   - Editable trip dates post-creation
   - Date confirmation during creation
   - Proper duration calculation (inclusive)

4. **Database Cleanup:**
   - Removed legacy device session tables
   - Simplified authentication architecture
   - Improved performance with OAuth-only flow

## Development Patterns

- **Prisma-First Database Access**: All DB operations through Prisma client
- **Group-Scoped Operations**: Data automatically filtered by travel group
- **Modal State Management**: Parent components manage modal state
- **Drag-to-Select Calendar**: Custom implementation in weekly view
- **Expense Integration**: Tightly coupled with events
- **Permission System**: Role-based (adventurer vs party member)

## Testing Utilities

Located in `scripts/` directory:
- `test-final-day-clickability.js` - Confirm final day fix

## Missing Features (Schema Ready)

- **Packing Lists**: `packing_items` table exists, needs implementation
- **Weather Integration**: Event schema supports weather field
- **Loadout Management**: Event schema supports loadout field