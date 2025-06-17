-- Enable Row Level Security and create session-based helper functions
-- Consolidated from standalone RLS migration files

BEGIN;

-- =====================================================
-- STEP 1: ENABLE ROW LEVEL SECURITY
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
-- STEP 2: SESSION VARIABLE HELPER FUNCTIONS
-- =====================================================

-- Function to set session variables (called from Supabase client)
CREATE OR REPLACE FUNCTION set_session_variable(variable_name TEXT, variable_value TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config(variable_name, variable_value, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely get session variables with fallback
CREATE OR REPLACE FUNCTION get_session_variable(variable_name TEXT, default_value TEXT DEFAULT NULL)
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(current_setting(variable_name, true), default_value);
EXCEPTION
  WHEN OTHERS THEN
    RETURN default_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current session group_id from request context
CREATE OR REPLACE FUNCTION current_session_group_id()
RETURNS UUID AS $$
BEGIN
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
-- STEP 3: BUSINESS LOGIC CONSTRAINTS
-- =====================================================

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

-- Test function to verify session variables are working
CREATE OR REPLACE FUNCTION test_session_context()
RETURNS TABLE(group_id TEXT, traveler_name TEXT) AS $$
BEGIN
  RETURN QUERY SELECT 
    get_session_variable('app.current_group_id') as group_id,
    get_session_variable('app.current_traveler_name') as traveler_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;