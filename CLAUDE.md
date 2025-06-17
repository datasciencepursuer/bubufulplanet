# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 vacation planning application with TypeScript, Tailwind CSS, and Prisma + Supabase. Features include trip planning with calendar views, day-by-day itineraries, expense tracking, and group-based collaboration.

## Development Commands

```bash
pnpm run dev         # Start development server (http://localhost:3000)
pnpm run build       # Build for production (includes prisma generate)
pnpm start           # Run production server
pnpm run lint        # Run ESLint with Next.js strict configuration
pnpm run db:migrate  # Deploy Prisma migrations
pnpm run db:generate # Generate Prisma client
pnpm run db:reset    # Reset database with fresh migrations
pnpm run db:seed     # Run database seeding
```

## Architecture

### Database Structure (Prisma + Supabase)
Hierarchical data model with group-based access control:
- `travel_groups` → `group_members` + `trips` + `device_sessions`
- `trips` → `trip_days` → `events` → `expenses`
- `packing_items` (linked to trips)

Database schema is managed via Prisma migrations in `prisma/migrations/`. All operations are scoped to travel groups with role-based permissions.

**CRITICAL: Schema Synchronization**
- `prisma/schema.prisma` - Source of truth for database structure
- Run `pnpm run db:generate` after schema changes to update Prisma client
- Use `pnpm prisma migrate dev` to create new migrations for schema changes
- Database access is through Prisma client (`@/lib/prisma`), not direct Supabase queries

### Database Access Strategy
- **Prisma Client** (`src/lib/prisma.ts`): Primary database interface for all operations
- **Supabase Clients**: Legacy - still present but being phased out in favor of Prisma
  - Browser Client (`src/lib/supabase/client.ts`)
  - Server Client (`src/lib/supabase/server.ts`) 
  - Service Client (`src/lib/supabase/service.ts`)

### Authentication Flow (Group-Based System)
- **Travel Groups**: Users create or join travel groups using unique access codes
- **Device Sessions**: Browser fingerprinting for automatic re-authentication (`src/hooks/useDeviceSession.ts`)
- **Unified Session Management** (`src/lib/unified-session.ts`): Combines cookie and device-based sessions
- **Middleware** (`src/middleware.ts`): Protects `/app` and `/trips` routes, validates group membership
- **Auth Routes**: `/api/groups/create`, `/api/groups/join`, `/api/auth/logout`, `/api/auth/verify-code`
- **No traditional user accounts** - authentication is group-based with traveler names

### Routing Structure
- `/` - Landing page with group creation/joining (public)
- `/app` - Main dashboard with trip listing (protected)
- `/trips/[id]` - **Trip details with weekly calendar and event management** (protected)
- `/group-settings` - Travel group management (protected)
- `/device-demo` - Device session testing page
- **API Routes**:
  - `/api/groups/*` - Group creation, joining, member management
  - `/api/trips/*` - Trip CRUD operations
  - `/api/events/*` - Event management with expense support
  - `/api/device-sessions/*` - Device fingerprinting and auto-login
  - `/api/auth/*` - Legacy auth endpoints (verify-code, logout)

### Key Implementation Details
1. **Group-Based Architecture**: All data is scoped to travel groups - no individual user accounts
2. **Device Fingerprinting**: Automatic re-authentication using browser characteristics (`src/lib/device-fingerprint.ts`)
3. **Date Management**: Trip creation automatically generates `trip_days` entries for the date range
4. **Weekly Calendar View**: Custom time-slot grid (6 AM-10 PM) with drag-to-select ranges in `WeeklyCalendarView.tsx`
5. **Event Modal**: Complete event creation/editing with embedded expense management (`EventModal.tsx`)
6. **Expense Integration**: Events can have multiple expenses (description, amount, category) saved via API
7. **Role-Based Permissions**: Group members have different roles (adventurer, party member) with varying permissions
8. **Clean Architecture**: Domain-driven design with entities, use cases, and repositories in `src/domain/`, `src/application/`, `src/infrastructure/`
9. **UI Components**: Limited shadcn/ui components (button, card, dialog) - extend as needed

### API Pattern Example
```typescript
// Standard API route pattern with group-based authentication
import { validateUnifiedSession } from '@/lib/unified-session'
import { prisma } from '@/lib/prisma'

const validation = await validateUnifiedSession()
if (!validation.isValid) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// Database operations via Prisma, automatically scoped to group
const trips = await prisma.trip.findMany({
  where: { groupId: validation.context!.groupId },
  orderBy: { createdAt: 'desc' }
})
```

## Environment Variables

Required in `.env.local`:
```
DATABASE_URL=                    # PostgreSQL connection string for Prisma
DIRECT_DATABASE_URL=             # Direct database URL for migrations
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL (legacy)
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anonymous key (legacy)
SUPABASE_SERVICE_ROLE_KEY=       # Service role key (legacy, keep secret!)
```

## Current Implementation Status
- ✅ **Group-based authentication** - Travel groups with access codes
- ✅ **Device session management** - Automatic re-authentication via fingerprinting
- ✅ **Trip creation and listing** - With automatic trip_days generation
- ✅ **Calendar date selection** - Drag-to-select ranges
- ✅ **Protected routes** - Middleware-based protection
- ✅ **Trip detail page with weekly calendar view** - Full time-slot grid (6 AM-10 PM)
- ✅ **Event management** - Complete CRUD with time-based calendar integration
- ✅ **Expense tracking** - Multiple expenses per event with categories
- ✅ **Group member management** - Role-based permissions (adventurer, party member)
- ❌ **Packing lists** - Database schema exists but no implementation

## Important Implementation Notes
- Path alias `@/*` maps to `./src/*`
- ESLint configured with `next/core-web-vitals`
- No testing framework configured
- All API routes require group-based authentication except landing page
- Package manager: pnpm preferred, npm as fallback
- Framework: Next.js 15 with App Router
- Date operations use `date-fns` library
- Database access primarily through Prisma client, not Supabase SDK

### Development Patterns
- **Group-Scoped Operations**: All data operations are automatically scoped to the user's travel group
- **Device Fingerprinting**: Uses `generateDeviceFingerprint()` for seamless re-authentication
- **Unified Session Management**: Combines cookie-based and device-based sessions via `unified-session.ts`
- **Event/Expense Pattern**: Events and expenses are tightly coupled - expenses are created/updated via event endpoints
- **Modal State Management**: Event editing uses `selectedEvent` state in `TripDetailClient` to pass data to `EventModal`
- **Calendar Integration**: `WeeklyCalendarView` handles time-slot clicks and passes `dayId` + time to parent for event creation
- **Permission Checking**: Use `requireUnifiedPermission()` to validate user permissions before operations
- **Clean Architecture**: Follow domain/application/infrastructure separation for business logic

### Missing Features with Schema Support
- **Packing Lists**: `packing_items` table exists but needs `/api/packing` endpoints and UI components
- **Weather Integration**: Event schema has weather field but no implementation
- **Loadout Management**: Event schema has loadout field but no UI implementation