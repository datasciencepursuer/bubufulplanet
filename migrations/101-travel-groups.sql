-- Travel Groups Schema Migration
-- This creates a group-based authentication system where travel groups 
-- are the primary access control mechanism instead of individual users

BEGIN;

-- Create travel_groups table
CREATE TABLE IF NOT EXISTS public.travel_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  access_code VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create group_members table (replaces user-based auth)
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE,
  traveler_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  session_id VARCHAR(255),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, traveler_name)
);

-- Add group_id to existing tables (migration strategy)
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_travel_groups_access_code ON public.travel_groups(access_code);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_session_id ON public.group_members(session_id);
CREATE INDEX IF NOT EXISTS idx_trips_group_id ON public.trips(group_id);

-- Enable Row Level Security for new tables
ALTER TABLE public.travel_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies (we'll replace with group-based ones)
DROP POLICY IF EXISTS "Users can view their own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can manage trip days for their trips" ON public.trip_days;
DROP POLICY IF EXISTS "Users can manage events for their trips" ON public.events;
DROP POLICY IF EXISTS "Users can manage expenses for their trips" ON public.expenses;
DROP POLICY IF EXISTS "Users can manage packing items for their trips" ON public.packing_items;

-- New group-based RLS policies
-- For travel_groups: members can view their group
CREATE POLICY "Members can view their travel group" ON public.travel_groups
  FOR SELECT USING (
    id IN (SELECT group_id FROM public.group_members WHERE session_id = current_setting('app.session_id', true))
  );

-- For group_members: members can view other members in their group
CREATE POLICY "Members can view group members" ON public.group_members
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM public.group_members WHERE session_id = current_setting('app.session_id', true))
  );

-- For trips: use group_id instead of user_id (with fallback for migration)
CREATE POLICY "Group members can manage trips" ON public.trips
  FOR ALL USING (
    -- New group-based access
    (group_id IS NOT NULL AND group_id IN (
      SELECT group_id FROM public.group_members 
      WHERE session_id = current_setting('app.session_id', true)
    ))
    OR
    -- Fallback for existing user_id based trips during migration
    (group_id IS NULL AND user_id = auth.uid())
  );

-- For trip_days: inherit from trips table
CREATE POLICY "Group members can manage trip days" ON public.trip_days
  FOR ALL USING (
    trip_id IN (
      SELECT id FROM public.trips 
      WHERE (group_id IS NOT NULL AND group_id IN (
        SELECT group_id FROM public.group_members 
        WHERE session_id = current_setting('app.session_id', true)
      ))
      OR (group_id IS NULL AND user_id = auth.uid())
    )
  );

-- For events: inherit from trip_days
CREATE POLICY "Group members can manage events" ON public.events
  FOR ALL USING (
    day_id IN (
      SELECT td.id FROM public.trip_days td
      JOIN public.trips t ON td.trip_id = t.id
      WHERE (t.group_id IS NOT NULL AND t.group_id IN (
        SELECT group_id FROM public.group_members 
        WHERE session_id = current_setting('app.session_id', true)
      ))
      OR (t.group_id IS NULL AND t.user_id = auth.uid())
    )
  );

-- For expenses: inherit from trip_days
CREATE POLICY "Group members can manage expenses" ON public.expenses
  FOR ALL USING (
    day_id IN (
      SELECT td.id FROM public.trip_days td
      JOIN public.trips t ON td.trip_id = t.id
      WHERE (t.group_id IS NOT NULL AND t.group_id IN (
        SELECT group_id FROM public.group_members 
        WHERE session_id = current_setting('app.session_id', true)
      ))
      OR (t.group_id IS NULL AND t.user_id = auth.uid())
    )
  );

-- For packing_items: inherit from trips
CREATE POLICY "Group members can manage packing items" ON public.packing_items
  FOR ALL USING (
    trip_id IN (
      SELECT id FROM public.trips 
      WHERE (group_id IS NOT NULL AND group_id IN (
        SELECT group_id FROM public.group_members 
        WHERE session_id = current_setting('app.session_id', true)
      ))
      OR (group_id IS NULL AND user_id = auth.uid())
    )
  );

-- Grant permissions to new tables
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.travel_groups TO anon, authenticated;
GRANT ALL ON public.group_members TO anon, authenticated;

-- Function to clean up inactive sessions (optional - for maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_inactive_sessions()
RETURNS void AS $$
BEGIN
  -- Remove sessions inactive for more than 30 days
  DELETE FROM public.group_members 
  WHERE last_active_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Update trigger for travel_groups
DROP TRIGGER IF EXISTS handle_travel_groups_updated_at ON public.travel_groups;
CREATE TRIGGER handle_travel_groups_updated_at
  BEFORE UPDATE ON public.travel_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Force RLS for new tables
ALTER TABLE public.travel_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE public.group_members FORCE ROW LEVEL SECURITY;

COMMIT;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Travel Groups schema migration completed successfully';
END $$;