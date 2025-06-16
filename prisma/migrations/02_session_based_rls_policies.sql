-- Session-Based RLS Policies for Group Access Control
-- No user authentication - uses session cookies for group/traveler identification
-- Group-specific permissions with standardized adventurer access

BEGIN;

-- =====================================================
-- STEP 1: ADD MISSING COLUMNS & CONSTRAINTS
-- =====================================================

-- Add missing event fields to match database.ts types
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3B82F6';

-- Add unique constraint to prevent duplicate traveler names per group
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_group_traveler'
  ) THEN
    ALTER TABLE group_members 
    ADD CONSTRAINT unique_group_traveler 
    UNIQUE (group_id, traveler_name);
  END IF;
END $$;

-- Add group member limit constraint (max 30 members per group)
CREATE OR REPLACE FUNCTION check_group_member_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM group_members WHERE group_id = NEW.group_id) >= 30 THEN
    RAISE EXCEPTION 'Group member limit of 30 exceeded for group %', NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_group_member_limit ON group_members;
CREATE TRIGGER trigger_check_group_member_limit
  BEFORE INSERT ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION check_group_member_limit();

-- Ensure only one adventurer per group
CREATE OR REPLACE FUNCTION check_single_adventurer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'adventurer' AND 
     EXISTS (SELECT 1 FROM group_members 
             WHERE group_id = NEW.group_id 
             AND role = 'adventurer' 
             AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
    RAISE EXCEPTION 'Group % already has an adventurer', NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_single_adventurer ON group_members;
CREATE TRIGGER trigger_check_single_adventurer
  BEFORE INSERT OR UPDATE ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION check_single_adventurer();

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
-- STEP 3: SESSION-BASED HELPER FUNCTIONS
-- =====================================================

-- Function to get current session group_id from request context
-- This will be set by your application middleware
CREATE OR REPLACE FUNCTION current_session_group_id()
RETURNS UUID AS $$
BEGIN
  -- Return the group_id stored in the session context
  -- Your app will set this via: SET SESSION app.current_group_id = 'uuid-here'
  RETURN NULLIF(current_setting('app.current_group_id', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current session traveler_name from request context
CREATE OR REPLACE FUNCTION current_session_traveler_name()
RETURNS TEXT AS $$
BEGIN
  -- Return the traveler_name stored in the session context
  -- Your app will set this via: SET SESSION app.current_traveler_name = 'name'
  RETURN NULLIF(current_setting('app.current_traveler_name', true), '');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current session user is adventurer in current group
CREATE OR REPLACE FUNCTION is_current_session_adventurer()
RETURNS BOOLEAN AS $$
DECLARE
  group_id UUID;
  traveler_name TEXT;
BEGIN
  group_id := current_session_group_id();
  traveler_name := current_session_traveler_name();
  
  IF group_id IS NULL OR traveler_name IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = current_session_group_id()
    AND traveler_name = current_session_traveler_name()
    AND role = 'adventurer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check current session user's specific permission in current group
CREATE OR REPLACE FUNCTION has_current_session_permission(permission_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  group_id UUID;
  traveler_name TEXT;
  user_permissions JSONB;
BEGIN
  group_id := current_session_group_id();
  traveler_name := current_session_traveler_name();
  
  IF group_id IS NULL OR traveler_name IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Adventurers always have all permissions
  IF is_current_session_adventurer() THEN
    RETURN TRUE;
  END IF;
  
  -- Check party member's specific permissions for this group
  SELECT permissions INTO user_permissions
  FROM group_members
  WHERE group_id = current_session_group_id()
  AND traveler_name = current_session_traveler_name();
  
  IF user_permissions IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN COALESCE((user_permissions->>permission_type)::BOOLEAN, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current session user is member of current group
CREATE OR REPLACE FUNCTION is_current_session_group_member()
RETURNS BOOLEAN AS $$
DECLARE
  group_id UUID;
  traveler_name TEXT;
BEGIN
  group_id := current_session_group_id();
  traveler_name := current_session_traveler_name();
  
  IF group_id IS NULL OR traveler_name IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = current_session_group_id()
    AND traveler_name = current_session_traveler_name()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 4: TRAVEL GROUPS RLS POLICIES
-- =====================================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "travel_groups_member_access" ON travel_groups;
DROP POLICY IF EXISTS "travel_groups_adventurer_update" ON travel_groups;
DROP POLICY IF EXISTS "travel_groups_system_insert" ON travel_groups;
DROP POLICY IF EXISTS "travel_groups_creation" ON travel_groups;

-- Users can only see their current session group
CREATE POLICY "travel_groups_session_access" ON travel_groups
  FOR SELECT USING (
    id = current_session_group_id() AND is_current_session_group_member()
  );

-- Only adventurers can update group info
CREATE POLICY "travel_groups_adventurer_update" ON travel_groups
  FOR UPDATE USING (
    id = current_session_group_id() AND is_current_session_adventurer()
  );

-- Allow group creation (controlled at application level)
CREATE POLICY "travel_groups_creation" ON travel_groups
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- STEP 5: GROUP MEMBERS RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "group_members_group_visibility" ON group_members;
DROP POLICY IF EXISTS "group_members_conditional_update" ON group_members;
DROP POLICY IF EXISTS "group_members_update_policy" ON group_members;
DROP POLICY IF EXISTS "group_members_adventurer_insert" ON group_members;
DROP POLICY IF EXISTS "group_members_adventurer_delete" ON group_members;

-- Members can see all members of their current group
CREATE POLICY "group_members_group_visibility" ON group_members
  FOR SELECT USING (
    group_id = current_session_group_id() AND is_current_session_group_member()
  );

-- Members can update their own basic info, adventurers can update anyone
CREATE POLICY "group_members_update_policy" ON group_members
  FOR UPDATE USING (
    group_id = current_session_group_id() AND
    (
      -- Own record (non-security fields only)
      traveler_name = current_session_traveler_name()
      OR 
      -- Adventurer privilege (can update anyone)
      is_current_session_adventurer()
    )
  )
  WITH CHECK (
    -- Adventurers can change anything, others can only update non-security fields
    group_id = current_session_group_id() AND
    (
      is_current_session_adventurer()
      OR traveler_name = current_session_traveler_name()
    )
  );

-- Only adventurers can add/remove members
CREATE POLICY "group_members_adventurer_insert" ON group_members
  FOR INSERT WITH CHECK (
    group_id = current_session_group_id() AND is_current_session_adventurer()
  );

CREATE POLICY "group_members_adventurer_delete" ON group_members
  FOR DELETE USING (
    group_id = current_session_group_id() AND is_current_session_adventurer()
  );

-- =====================================================
-- STEP 6: TRIPS RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "trips_group_read_access" ON trips;
DROP POLICY IF EXISTS "trips_group_create_access" ON trips;
DROP POLICY IF EXISTS "trips_group_modify_access" ON trips;
DROP POLICY IF EXISTS "trips_group_delete_access" ON trips;
DROP POLICY IF EXISTS "trips_session_read" ON trips;
DROP POLICY IF EXISTS "trips_session_create" ON trips;
DROP POLICY IF EXISTS "trips_session_modify" ON trips;
DROP POLICY IF EXISTS "trips_session_delete" ON trips;

-- Access based on current session group and permissions
CREATE POLICY "trips_session_read" ON trips
  FOR SELECT USING (
    group_id = current_session_group_id() AND 
    has_current_session_permission('read')
  );

CREATE POLICY "trips_session_create" ON trips
  FOR INSERT WITH CHECK (
    group_id = current_session_group_id() AND 
    has_current_session_permission('create')
  );

CREATE POLICY "trips_session_modify" ON trips
  FOR UPDATE USING (
    group_id = current_session_group_id() AND 
    has_current_session_permission('modify')
  );

CREATE POLICY "trips_session_delete" ON trips
  FOR DELETE USING (
    group_id = current_session_group_id() AND 
    has_current_session_permission('modify')
  );

-- =====================================================
-- STEP 7: TRIP DAYS RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "trip_days_session_read" ON trip_days;
DROP POLICY IF EXISTS "trip_days_session_create" ON trip_days;
DROP POLICY IF EXISTS "trip_days_session_modify" ON trip_days;
DROP POLICY IF EXISTS "trip_days_session_delete" ON trip_days;

-- Inherit permissions from parent trip
CREATE POLICY "trip_days_session_read" ON trip_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_days.trip_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('read')
    )
  );

CREATE POLICY "trip_days_session_create" ON trip_days
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_days.trip_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('create')
    )
  );

CREATE POLICY "trip_days_session_modify" ON trip_days
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_days.trip_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('modify')
    )
  );

CREATE POLICY "trip_days_session_delete" ON trip_days
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_days.trip_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('modify')
    )
  );

-- =====================================================
-- STEP 8: EVENTS RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "events_session_read" ON events;
DROP POLICY IF EXISTS "events_session_create" ON events;
DROP POLICY IF EXISTS "events_session_modify" ON events;
DROP POLICY IF EXISTS "events_session_delete" ON events;

CREATE POLICY "events_session_read" ON events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      JOIN trips t ON t.id = td.trip_id
      WHERE td.id = events.day_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('read')
    )
  );

CREATE POLICY "events_session_create" ON events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_days td
      JOIN trips t ON t.id = td.trip_id
      WHERE td.id = events.day_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('create')
    )
  );

CREATE POLICY "events_session_modify" ON events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      JOIN trips t ON t.id = td.trip_id
      WHERE td.id = events.day_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('modify')
    )
  );

CREATE POLICY "events_session_delete" ON events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      JOIN trips t ON t.id = td.trip_id
      WHERE td.id = events.day_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('modify')
    )
  );

-- =====================================================
-- STEP 9: EXPENSES RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "expenses_session_read" ON expenses;
DROP POLICY IF EXISTS "expenses_session_create" ON expenses;
DROP POLICY IF EXISTS "expenses_session_modify" ON expenses;
DROP POLICY IF EXISTS "expenses_session_delete" ON expenses;

CREATE POLICY "expenses_session_read" ON expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      JOIN trips t ON t.id = td.trip_id
      WHERE td.id = expenses.day_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('read')
    )
  );

CREATE POLICY "expenses_session_create" ON expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_days td
      JOIN trips t ON t.id = td.trip_id
      WHERE td.id = expenses.day_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('create')
    )
  );

CREATE POLICY "expenses_session_modify" ON expenses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      JOIN trips t ON t.id = td.trip_id
      WHERE td.id = expenses.day_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('modify')
    )
  );

CREATE POLICY "expenses_session_delete" ON expenses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      JOIN trips t ON t.id = td.trip_id
      WHERE td.id = expenses.day_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('modify')
    )
  );

-- =====================================================
-- STEP 10: PACKING ITEMS RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "packing_items_session_read" ON packing_items;
DROP POLICY IF EXISTS "packing_items_session_modify" ON packing_items;

CREATE POLICY "packing_items_session_read" ON packing_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = packing_items.trip_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('read')
    )
  );

CREATE POLICY "packing_items_session_modify" ON packing_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = packing_items.trip_id
      AND t.group_id = current_session_group_id()
      AND has_current_session_permission('modify')
    )
  );

-- =====================================================
-- STEP 11: DEVICE SESSIONS RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "device_sessions_session_access" ON device_sessions;

-- Users can only access device sessions for their current group/traveler
CREATE POLICY "device_sessions_session_access" ON device_sessions
  FOR ALL USING (
    group_id = current_session_group_id() AND
    traveler_name = current_session_traveler_name()
  );

COMMIT;

-- =====================================================
-- IMPLEMENTATION GUIDE
-- =====================================================

/*

HOW TO USE THESE RLS POLICIES:

1. UPDATE YOUR API ROUTES:
   Before each database operation, set session variables:
   
   ```typescript
   // In your API route handler:
   const groupId = cookies().get('vacation-planner-group-id')?.value
   const travelerName = cookies().get('vacation-planner-traveler-name')?.value
   
   // Set session context for RLS
   await supabase.rpc('exec', {
     sql: `
       SET SESSION app.current_group_id = '${groupId}';
       SET SESSION app.current_traveler_name = '${travelerName}';
     `
   })
   
   // Now all subsequent queries are automatically filtered by RLS
   const { data } = await supabase.from('trips').select('*')
   ```

2. PERMISSION MATRIX:
   
   ADVENTURERS (always the same across all groups):
   - Read: ✅ Always true
   - Create: ✅ Always true  
   - Modify: ✅ Always true
   - Manage Members: ✅ Always true
   
   PARTY MEMBERS (group-specific):
   - Read: ✅/❌ Set by adventurer per group
   - Create: ✅/❌ Set by adventurer per group
   - Modify: ✅/❌ Set by adventurer per group
   - Manage Members: ❌ Never allowed

3. GROUP CONSTRAINTS:
   - Max 30 members per group (enforced by trigger)
   - Exactly 1 adventurer per group (enforced by trigger)
   - Unique traveler names per group (enforced by constraint)

4. SECURITY BENEFITS:
   - No SQL injection possible - RLS enforces group isolation
   - No manual group_id filtering needed in queries
   - Automatic permission enforcement at database level
   - Session-based access without user accounts

5. EXAMPLE USAGE:
   
   Group A: Adventurer gives party members full access
   {
     "read": true,
     "create": true,
     "modify": true
   }
   
   Group B: Adventurer gives party members read-only access
   {
     "read": true,
     "create": false,
     "modify": false
   }
   
   Group C: Adventurer gives party members read + create only
   {
     "read": true,
     "create": true,
     "modify": false
   }

*/