-- Session Context Function
-- Creates an RPC function to set session variables for RLS policies

BEGIN;

-- Create function to set session context
CREATE OR REPLACE FUNCTION public.set_session_context(current_traveler TEXT)
RETURNS void AS $$
BEGIN
  -- Set the session variable that RLS policies use
  PERFORM set_config('app.current_traveler', current_traveler, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.set_session_context(TEXT) TO anon, authenticated;

COMMIT;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Session context function created successfully';
END $$;