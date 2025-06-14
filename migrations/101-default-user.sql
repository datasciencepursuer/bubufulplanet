-- Create a default user for the vacation planner app
-- This user will be used for all operations since we're not using real authentication

BEGIN;

-- Create a default user in the auth.users table
-- Using a fixed UUID so it's consistent across restarts
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'default@vacation-planner.local',
  crypt('not-a-real-password', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Default User"}'::jsonb,
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Create a function to get the default user ID
CREATE OR REPLACE FUNCTION public.get_default_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN '00000000-0000-0000-0000-000000000001'::uuid;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update RLS policies to use the default user ID instead of auth.uid()
-- This makes all data accessible when using the default user

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can manage trip days for their trips" ON public.trip_days;
DROP POLICY IF EXISTS "Users can manage events for their trips" ON public.events;
DROP POLICY IF EXISTS "Users can manage expenses for their trips" ON public.expenses;
DROP POLICY IF EXISTS "Users can manage packing items for their trips" ON public.packing_items;

-- Recreate policies using the default user ID
CREATE POLICY "Default user can manage trips" ON public.trips
  FOR ALL USING (user_id = public.get_default_user_id());

CREATE POLICY "Default user can manage trip days" ON public.trip_days
  FOR ALL USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = public.get_default_user_id())
  );

CREATE POLICY "Default user can manage events" ON public.events
  FOR ALL USING (
    day_id IN (
      SELECT td.id FROM public.trip_days td
      JOIN public.trips t ON td.trip_id = t.id
      WHERE t.user_id = public.get_default_user_id()
    )
  );

CREATE POLICY "Default user can manage expenses" ON public.expenses
  FOR ALL USING (
    day_id IN (
      SELECT td.id FROM public.trip_days td
      JOIN public.trips t ON td.trip_id = t.id
      WHERE t.user_id = public.get_default_user_id()
    )
  );

CREATE POLICY "Default user can manage packing items" ON public.packing_items
  FOR ALL USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = public.get_default_user_id())
  );

COMMIT;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Default user created with ID: 00000000-0000-0000-0000-000000000001';
END $$;