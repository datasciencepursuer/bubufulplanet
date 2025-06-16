# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 vacation planning application with TypeScript, Tailwind CSS, and Supabase. Features include trip planning with calendar views, day-by-day itineraries, expense tracking, and packing lists.

## Development Commands

```bash
pnpm run dev      # Start development server (http://localhost:3000)
pnpm run build    # Build for production
pnpm start        # Run production server
pnpm run lint     # Run ESLint with Next.js strict configuration
```

## Architecture

### Database Structure (Supabase + Prisma)
Hierarchical data model with Row Level Security:
- `trips` → `trip_days` → `events` → `expenses`
- `packing_items` (linked to trips)
- `travel_groups` → `group_members` + `device_sessions`

All tables enforce group-based access control via RLS policies. Database schema is managed via Prisma migrations in `prisma/migrations/`.

**CRITICAL: Schema Synchronization**
- `prisma/schema.prisma` - Source of truth for database structure
- `src/types/database.ts` - TypeScript types for Supabase client
- **When updating either file, ALWAYS update the other to maintain sync**
- Run `pnpm prisma db push` after schema changes to update database
- Generate new migration with `pnpm prisma migrate dev` for production changes

### Supabase Client Strategy
- **Browser Client** (`src/lib/supabase/client.ts`): Client components, uses `createBrowserClient`
- **Server Client** (`src/lib/supabase/server.ts`): Server components/API routes, handles cookies with `createServerClient`
- **Service Client** (`src/lib/supabase/service.ts`): Admin operations, bypasses RLS (use carefully)

### Authentication Flow
- **Middleware** (`src/middleware.ts`): Protects `/app` and `/trips` routes, redirects unauthenticated users
- **Auth Routes**: `/api/auth/login`, `/api/auth/signup`, `/api/auth/logout`
- **AuthForm Component**: Reusable form for login/signup pages
- Session management via Supabase Auth with cookie-based sessions

### Routing Structure
- `/landing` - Marketing page (public)
- `/login`, `/signup` - Authentication pages
- `/app` - Main dashboard (protected)
- `/trips/[id]` - **Trip details with weekly calendar and event management** (protected)
- `/api/trips` - CRUD endpoints for trips
- `/api/events` - Complete event management API with expense support

### Key Implementation Details
1. **Date Management**: `/api/trips` POST automatically generates `trip_days` entries for the date range
2. **Weekly Calendar View**: Custom time-slot grid (6 AM-10 PM) with drag-to-select ranges in `WeeklyCalendarView.tsx`
3. **Event Modal**: Complete event creation/editing with embedded expense management (`EventModal.tsx`)
4. **Expense Integration**: Events can have multiple expenses (description, amount, category) saved via API
5. **Real-time Updates**: Auth state changes trigger UI updates via `onAuthStateChange`
6. **UI Components**: Limited shadcn/ui components (button, card, dialog) - extend as needed
7. **TypeScript Types**: Database types in `src/types/database.ts` must stay synchronized with `prisma/schema.prisma`

### API Pattern Example
```typescript
// Standard API route pattern with authentication
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// Database operations automatically scoped to user via RLS
const { data, error } = await supabase
  .from('trips')
  .select('*')
  .order('created_at', { ascending: false })
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY=       # Service role key (keep secret!)
```

## Current Implementation Status
- ✅ User authentication (email/password)
- ✅ Trip creation and listing with automatic trip_days generation
- ✅ Calendar date selection with drag-to-select ranges
- ✅ Protected routes with middleware
- ✅ **Trip detail page with weekly calendar view** - Full time-slot grid (6 AM-10 PM)
- ✅ **Event management** - Complete CRUD with time-based calendar integration
- ✅ **Expense tracking** - Multiple expenses per event with categories
- ❌ **Packing lists** - Database schema exists but no implementation

## Important Implementation Notes
- Path alias `@/*` maps to `./src/*`
- ESLint configured with `next/core-web-vitals`
- No testing framework configured
- All API routes require authentication except auth endpoints
- Package manager: pnpm preferred, npm as fallback
- Framework: Next.js 15 with App Router
- Date operations use `date-fns` library

### Development Patterns
- **Event/Expense Pattern**: Events and expenses are tightly coupled - expenses are created/updated via event endpoints
- **Modal State Management**: Event editing uses `selectedEvent` state in `TripDetailClient` to pass data to `EventModal`
- **Calendar Integration**: `WeeklyCalendarView` handles time-slot clicks and passes `dayId` + time to parent for event creation
- **RLS Security**: All database queries automatically scope to session-based group access - no manual group filtering needed in API routes
- **Schema Maintenance**: When modifying `prisma/schema.prisma`, immediately update `src/types/database.ts` to match. When updating `database.ts` types, verify corresponding Prisma model exists and is accurate.

### Missing Features with Schema Support
- **Packing Lists**: `packing_items` table exists but needs `/api/packing` endpoints and UI components
- **Dashboard Actions**: Expense summaries, packing templates, saved destinations are placeholder buttons