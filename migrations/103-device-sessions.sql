-- Device Session Caching Schema
-- This creates a system to remember devices and automatically log users back into their groups

BEGIN;

-- Create device_sessions table to track device-based logins
CREATE TABLE IF NOT EXISTS public.device_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_fingerprint VARCHAR(255) NOT NULL,
  group_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE,
  traveler_name VARCHAR(255) NOT NULL,
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  user_agent TEXT,
  ip_address INET,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(device_fingerprint, group_id, traveler_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_device_sessions_fingerprint ON public.device_sessions(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_device_sessions_group_traveler ON public.device_sessions(group_id, traveler_name);
CREATE INDEX IF NOT EXISTS idx_device_sessions_expires ON public.device_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_device_sessions_active ON public.device_sessions(is_active);

-- Create a function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_device_sessions()
RETURNS void AS $$
BEGIN
  -- Mark expired sessions as inactive
  UPDATE public.device_sessions 
  SET is_active = false 
  WHERE expires_at < NOW() AND is_active = true;
  
  -- Delete sessions older than 90 days
  DELETE FROM public.device_sessions 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Create a function to refresh device session
CREATE OR REPLACE FUNCTION public.refresh_device_session(
  p_device_fingerprint VARCHAR(255),
  p_group_id UUID,
  p_traveler_name VARCHAR(255),
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  session_id UUID;
BEGIN
  -- Update existing session or create new one
  INSERT INTO public.device_sessions (
    device_fingerprint,
    group_id,
    traveler_name,
    last_login_at,
    expires_at,
    user_agent,
    ip_address,
    is_active
  ) VALUES (
    p_device_fingerprint,
    p_group_id,
    p_traveler_name,
    NOW(),
    NOW() + INTERVAL '30 days',
    p_user_agent,
    p_ip_address,
    true
  )
  ON CONFLICT (device_fingerprint, group_id, traveler_name) 
  DO UPDATE SET
    last_login_at = NOW(),
    expires_at = NOW() + INTERVAL '30 days',
    user_agent = COALESCE(EXCLUDED.user_agent, device_sessions.user_agent),
    ip_address = COALESCE(EXCLUDED.ip_address, device_sessions.ip_address),
    is_active = true
  RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS for device_sessions
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for device_sessions
CREATE POLICY "Users can manage their own device sessions" ON public.device_sessions
  FOR ALL USING (
    group_id::text = current_setting('app.current_group_id', true) AND
    traveler_name = current_setting('app.current_traveler', true)
  );

-- Allow reading device sessions for authentication (before group context is set)
CREATE POLICY "Allow device session lookup" ON public.device_sessions
  FOR SELECT USING (is_active = true AND expires_at > NOW());

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.device_sessions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_device_sessions() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_device_session(VARCHAR(255), UUID, VARCHAR(255), TEXT, INET) TO anon, authenticated;

-- Force RLS
ALTER TABLE public.device_sessions FORCE ROW LEVEL SECURITY;

-- Create a scheduled cleanup job (this would typically be run by a cron job)
COMMENT ON FUNCTION public.cleanup_expired_device_sessions() IS 'Run periodically to clean up expired device sessions';

COMMIT;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Device sessions schema migration completed successfully';
END $$;