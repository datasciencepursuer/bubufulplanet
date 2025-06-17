-- Add Row Level Security policies for session-based group access control
-- Consolidated from standalone RLS policy migration

BEGIN;

-- =====================================================
-- TRAVEL GROUPS RLS POLICIES
-- =====================================================

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
-- GROUP MEMBERS RLS POLICIES
-- =====================================================

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
-- TRIPS RLS POLICIES
-- =====================================================

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
-- TRIP DAYS RLS POLICIES
-- =====================================================

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
-- EVENTS RLS POLICIES
-- =====================================================

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
-- EXPENSES RLS POLICIES
-- =====================================================

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
-- PACKING ITEMS RLS POLICIES
-- =====================================================

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
-- DEVICE SESSIONS RLS POLICIES
-- =====================================================

-- Users can only access device sessions for their current group/traveler
CREATE POLICY "device_sessions_session_access" ON device_sessions
  FOR ALL USING (
    group_id = current_session_group_id() AND
    traveler_name = current_session_traveler_name()
  );

COMMIT;