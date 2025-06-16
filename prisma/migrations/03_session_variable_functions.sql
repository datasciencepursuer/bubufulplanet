-- Session Variable Helper Functions
-- Creates functions to set and get session variables for RLS policies

BEGIN;

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

-- Usage Examples:
-- 1. Set session variables:
--    SELECT set_session_variable('app.current_group_id', 'uuid-here');
--    SELECT set_session_variable('app.current_traveler_name', 'John Doe');
--
-- 2. Test that variables are set:
--    SELECT * FROM test_session_context();
--
-- 3. The RLS functions will automatically use these variables