-- Travel Groups Migration
-- Adds support for travel groups with role-based permissions

BEGIN;

-- Create travel_groups table
CREATE TABLE IF NOT EXISTS public.travel_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  access_code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL -- Reference to the group creator
);

-- Create group_members table with roles and permissions
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE,
  traveler_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'follower', -- 'adventurer' (leader) or 'follower'
  permissions JSONB DEFAULT '{"read": true, "create": false, "modify": false}',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID, -- Who added this member (NULL for self-join)
  UNIQUE(group_id, traveler_name)
);

-- Add group_id to existing tables to support group-based access
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_travel_groups_access_code ON public.travel_groups(access_code);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_traveler_name ON public.group_members(traveler_name);
CREATE INDEX IF NOT EXISTS idx_trips_group_id ON public.trips(group_id);

-- Enable Row Level Security
ALTER TABLE public.travel_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Group members can view their groups" ON public.travel_groups;
DROP POLICY IF EXISTS "Group members can view group membership" ON public.group_members;
DROP POLICY IF EXISTS "Adventurers can manage group members" ON public.group_members;
DROP POLICY IF EXISTS "Users can view trips in their groups" ON public.trips;

-- RLS Policies for travel_groups table
CREATE POLICY "Group members can view their groups" ON public.travel_groups
  FOR SELECT USING (
    id IN (SELECT group_id FROM public.group_members WHERE traveler_name = current_setting('app.current_traveler', true))
  );

CREATE POLICY "Anyone can create groups" ON public.travel_groups
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Adventurers can update their groups" ON public.travel_groups
  FOR UPDATE USING (
    id IN (
      SELECT group_id FROM public.group_members 
      WHERE traveler_name = current_setting('app.current_traveler', true) 
      AND role = 'adventurer'
    )
  );

-- RLS Policies for group_members table
CREATE POLICY "Group members can view group membership" ON public.group_members
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM public.group_members WHERE traveler_name = current_setting('app.current_traveler', true))
  );

CREATE POLICY "Anyone can join groups" ON public.group_members
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Adventurers can manage group members" ON public.group_members
  FOR ALL USING (
    group_id IN (
      SELECT group_id FROM public.group_members 
      WHERE traveler_name = current_setting('app.current_traveler', true) 
      AND role = 'adventurer'
    )
  );

CREATE POLICY "Members can update their own profile" ON public.group_members
  FOR UPDATE USING (traveler_name = current_setting('app.current_traveler', true));

-- Update trips RLS policy to support group-based access
DROP POLICY IF EXISTS "Users can view their own trips" ON public.trips;
CREATE POLICY "Group members can view group trips" ON public.trips
  FOR SELECT USING (
    CASE 
      WHEN group_id IS NOT NULL THEN
        group_id IN (SELECT group_id FROM public.group_members WHERE traveler_name = current_setting('app.current_traveler', true))
      ELSE
        auth.uid() = user_id -- Fallback for legacy trips without groups
    END
  );

CREATE POLICY "Group members can create trips based on permissions" ON public.trips
  FOR INSERT WITH CHECK (
    CASE 
      WHEN group_id IS NOT NULL THEN
        group_id IN (
          SELECT gm.group_id FROM public.group_members gm
          WHERE gm.traveler_name = current_setting('app.current_traveler', true)
          AND (gm.permissions->>'create')::boolean = true
        )
      ELSE
        auth.uid() = user_id -- Fallback for legacy trips without groups
    END
  );

CREATE POLICY "Group members can update trips based on permissions" ON public.trips
  FOR UPDATE USING (
    CASE 
      WHEN group_id IS NOT NULL THEN
        group_id IN (
          SELECT gm.group_id FROM public.group_members gm
          WHERE gm.traveler_name = current_setting('app.current_traveler', true)
          AND (gm.permissions->>'modify')::boolean = true
        )
      ELSE
        auth.uid() = user_id -- Fallback for legacy trips without groups
    END
  );

CREATE POLICY "Group members can delete trips based on permissions" ON public.trips
  FOR DELETE USING (
    CASE 
      WHEN group_id IS NOT NULL THEN
        group_id IN (
          SELECT gm.group_id FROM public.group_members gm
          WHERE gm.traveler_name = current_setting('app.current_traveler', true)
          AND (gm.permissions->>'modify')::boolean = true
        )
      ELSE
        auth.uid() = user_id -- Fallback for legacy trips without groups
    END
  );

-- Create a function to automatically update updated_at timestamp for travel_groups
DROP TRIGGER IF EXISTS handle_travel_groups_updated_at ON public.travel_groups;
CREATE TRIGGER handle_travel_groups_updated_at
  BEFORE UPDATE ON public.travel_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.travel_groups TO anon, authenticated;
GRANT ALL ON public.group_members TO anon, authenticated;

-- Ensure RLS is enforced for all roles
ALTER TABLE public.travel_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE public.group_members FORCE ROW LEVEL SECURITY;

COMMIT;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Travel Groups migration completed successfully';
END $$;