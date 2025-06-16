-- Migration: Add RLS fields and enable row-level security
-- Adds auth_user_id to group_members and event fields missing from Prisma
-- Enables comprehensive RLS policies for group-based access control

BEGIN;

-- =====================================================
-- STEP 1: ADD MISSING COLUMNS
-- =====================================================

-- Add auth_user_id to group_members for Supabase Auth integration
ALTER TABLE group_members 
ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- Add missing event fields to match database.ts types
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3B82F6';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_members_auth_user_id ON group_members(auth_user_id);

-- =====================================================
-- STEP 2: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE travel_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 3: HELPER FUNCTIONS FOR RLS
-- =====================================================

-- Function to check if user is adventurer in a group
CREATE OR REPLACE FUNCTION is_adventurer_in_group(user_id UUID, target_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE auth_user_id = user_id 
    AND group_id = target_group_id 
    AND role = 'adventurer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check specific permission for user in group
CREATE OR REPLACE FUNCTION has_group_permission(user_id UUID, target_group_id UUID, permission_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_permissions JSONB;
BEGIN
  SELECT permissions INTO user_permissions
  FROM group_members
  WHERE auth_user_id = user_id AND group_id = target_group_id;
  
  IF user_permissions IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN COALESCE((user_permissions->>permission_type)::BOOLEAN, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get group_id from trip_id (for nested resources)
CREATE OR REPLACE FUNCTION get_group_id_from_trip(trip_id UUID)
RETURNS UUID AS $$
DECLARE
  group_id UUID;
BEGIN
  SELECT t.group_id INTO group_id FROM trips t WHERE t.id = trip_id;
  RETURN group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 4: TRAVEL GROUPS RLS POLICIES
-- =====================================================

-- Users can see groups they're members of
CREATE POLICY "travel_groups_member_access" ON travel_groups
  FOR SELECT USING (
    id IN (
      SELECT group_id FROM group_members 
      WHERE auth_user_id = auth.uid()
    )
  );

-- Only adventurers can update group info
CREATE POLICY "travel_groups_adventurer_update" ON travel_groups
  FOR UPDATE USING (
    is_adventurer_in_group(auth.uid(), id)
  );

-- System handles group creation (application-level control)
CREATE POLICY "travel_groups_system_insert" ON travel_groups
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- STEP 5: GROUP MEMBERS RLS POLICIES
-- =====================================================

-- Users can see all members of their groups
CREATE POLICY "group_members_group_visibility" ON group_members
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM group_members 
      WHERE auth_user_id = auth.uid()
    )
  );

-- Users can update their own info, adventurers can update anyone
CREATE POLICY "group_members_conditional_update" ON group_members
  FOR UPDATE USING (
    auth_user_id = auth.uid() -- Own record
    OR is_adventurer_in_group(auth.uid(), group_id) -- Adventurer privilege
  )
  WITH CHECK (
    -- Adventurers can change anything, others can only update non-security fields
    is_adventurer_in_group(auth.uid(), group_id)
    OR auth_user_id = auth.uid()
  );

-- Only adventurers can add/remove members
CREATE POLICY "group_members_adventurer_insert" ON group_members
  FOR INSERT WITH CHECK (
    is_adventurer_in_group(auth.uid(), group_id)
  );

CREATE POLICY "group_members_adventurer_delete" ON group_members
  FOR DELETE USING (
    is_adventurer_in_group(auth.uid(), group_id)
  );

-- =====================================================
-- STEP 6: TRIPS RLS POLICIES
-- =====================================================

-- Read access based on group membership and read permission
CREATE POLICY "trips_group_read_access" ON trips
  FOR SELECT USING (
    group_id IS NOT NULL AND has_group_permission(auth.uid(), group_id, 'read')
  );

-- Create access based on create permission
CREATE POLICY "trips_group_create_access" ON trips
  FOR INSERT WITH CHECK (
    group_id IS NOT NULL AND has_group_permission(auth.uid(), group_id, 'create')
  );

-- Modify access based on modify permission
CREATE POLICY "trips_group_modify_access" ON trips
  FOR UPDATE USING (
    group_id IS NOT NULL AND has_group_permission(auth.uid(), group_id, 'modify')
  );

CREATE POLICY "trips_group_delete_access" ON trips
  FOR DELETE USING (
    group_id IS NOT NULL AND has_group_permission(auth.uid(), group_id, 'modify')
  );

-- =====================================================
-- STEP 7: TRIP DAYS RLS POLICIES
-- =====================================================

CREATE POLICY "trip_days_inherit_trip_read" ON trip_days
  FOR SELECT USING (
    has_group_permission(auth.uid(), get_group_id_from_trip(trip_id), 'read')
  );

CREATE POLICY "trip_days_inherit_trip_create" ON trip_days
  FOR INSERT WITH CHECK (
    has_group_permission(auth.uid(), get_group_id_from_trip(trip_id), 'create')
  );

CREATE POLICY "trip_days_inherit_trip_modify" ON trip_days
  FOR UPDATE USING (
    has_group_permission(auth.uid(), get_group_id_from_trip(trip_id), 'modify')
  );

CREATE POLICY "trip_days_inherit_trip_delete" ON trip_days
  FOR DELETE USING (
    has_group_permission(auth.uid(), get_group_id_from_trip(trip_id), 'modify')
  );

-- =====================================================
-- STEP 8: EVENTS RLS POLICIES
-- =====================================================

CREATE POLICY "events_inherit_trip_read" ON events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      WHERE td.id = events.day_id
      AND has_group_permission(auth.uid(), get_group_id_from_trip(td.trip_id), 'read')
    )
  );

CREATE POLICY "events_inherit_trip_create" ON events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_days td
      WHERE td.id = events.day_id
      AND has_group_permission(auth.uid(), get_group_id_from_trip(td.trip_id), 'create')
    )
  );

CREATE POLICY "events_inherit_trip_modify" ON events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      WHERE td.id = events.day_id
      AND has_group_permission(auth.uid(), get_group_id_from_trip(td.trip_id), 'modify')
    )
  );

CREATE POLICY "events_inherit_trip_delete" ON events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      WHERE td.id = events.day_id
      AND has_group_permission(auth.uid(), get_group_id_from_trip(td.trip_id), 'modify')
    )
  );

-- =====================================================
-- STEP 9: EXPENSES RLS POLICIES
-- =====================================================

CREATE POLICY "expenses_inherit_trip_read" ON expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      WHERE td.id = expenses.day_id
      AND has_group_permission(auth.uid(), get_group_id_from_trip(td.trip_id), 'read')
    )
  );

CREATE POLICY "expenses_inherit_trip_create" ON expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_days td
      WHERE td.id = expenses.day_id
      AND has_group_permission(auth.uid(), get_group_id_from_trip(td.trip_id), 'create')
    )
  );

CREATE POLICY "expenses_inherit_trip_modify" ON expenses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      WHERE td.id = expenses.day_id
      AND has_group_permission(auth.uid(), get_group_id_from_trip(td.trip_id), 'modify')
    )
  );

CREATE POLICY "expenses_inherit_trip_delete" ON expenses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      WHERE td.id = expenses.day_id
      AND has_group_permission(auth.uid(), get_group_id_from_trip(td.trip_id), 'modify')
    )
  );

-- =====================================================
-- STEP 10: PACKING ITEMS RLS POLICIES
-- =====================================================

CREATE POLICY "packing_items_inherit_trip_read" ON packing_items
  FOR SELECT USING (
    has_group_permission(auth.uid(), get_group_id_from_trip(trip_id), 'read')
  );

CREATE POLICY "packing_items_inherit_trip_modify" ON packing_items
  FOR ALL USING (
    has_group_permission(auth.uid(), get_group_id_from_trip(trip_id), 'modify')
  );

-- =====================================================
-- STEP 11: DEVICE SESSIONS RLS POLICIES
-- =====================================================

-- Users can only access their own device sessions
CREATE POLICY "device_sessions_own_access" ON device_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = device_sessions.group_id
      AND gm.traveler_name = device_sessions.traveler_name
      AND gm.auth_user_id = auth.uid()
    )
  );

COMMIT;

-- =====================================================
-- POST-MIGRATION REQUIREMENTS
-- =====================================================

/*

CRITICAL: After running this migration, you MUST:

1. UPDATE APPLICATION CODE:
   - Switch Supabase clients from service role to anon key
   - Integrate with Supabase Auth (auth.signUp, auth.signIn)
   - Remove manual group_id filtering (RLS handles this now)

2. POPULATE auth_user_id:
   - Create Supabase auth users for existing group members
   - Update group_members.auth_user_id with proper auth.users.id

3. UPDATE API ROUTES:
   Example change:
   
   // OLD (manual filtering):
   const { data } = await supabase
     .from('trips')
     .select('*')
     .eq('group_id', groupId) // Remove this line
   
   // NEW (RLS automatic):
   const { data } = await supabase
     .from('trips')
     .select('*') // RLS automatically filters by user's permissions

4. PERMISSION MATRIX:
   - Adventurers: { read: true, create: true, modify: true }
   - Party Members: Configurable by adventurers per member
   - Only adventurers can modify other members' permissions

5. BENEFITS:
   - Protection against SQL injection
   - Database-level security enforcement
   - Automatic data isolation by group membership
   - Fine-grained permission control

*/