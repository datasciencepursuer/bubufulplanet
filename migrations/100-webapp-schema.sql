-- Vacation Planner Application Schema Migration
-- This file is executed during Supabase database initialization

BEGIN;

-- Create trips table
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  destination VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create trip_days table
CREATE TABLE IF NOT EXISTS public.trip_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trip_id, day_number),
  UNIQUE(trip_id, date)
);

-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_id UUID REFERENCES public.trip_days(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  location VARCHAR(255),
  notes TEXT,
  weather VARCHAR(255),
  loadout TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  day_id UUID REFERENCES public.trip_days(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create packing_items table
CREATE TABLE IF NOT EXISTS public.packing_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  quantity INTEGER DEFAULT 1,
  packed BOOLEAN DEFAULT FALSE,
  category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON public.trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_dates ON public.trips(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_trip_days_trip_id ON public.trip_days(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_days_date ON public.trip_days(date);
CREATE INDEX IF NOT EXISTS idx_events_day_id ON public.events(day_id);
CREATE INDEX IF NOT EXISTS idx_events_time ON public.events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_expenses_day_id ON public.expenses(day_id);
CREATE INDEX IF NOT EXISTS idx_expenses_event_id ON public.expenses(event_id);
CREATE INDEX IF NOT EXISTS idx_packing_items_trip_id ON public.packing_items(trip_id);

-- Enable Row Level Security
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packing_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can manage trip days for their trips" ON public.trip_days;
DROP POLICY IF EXISTS "Users can manage events for their trips" ON public.events;
DROP POLICY IF EXISTS "Users can manage expenses for their trips" ON public.expenses;
DROP POLICY IF EXISTS "Users can manage packing items for their trips" ON public.packing_items;

-- RLS Policies for trips table
CREATE POLICY "Users can view their own trips" ON public.trips
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for trip_days table
CREATE POLICY "Users can manage trip days for their trips" ON public.trip_days
  FOR ALL USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  );

-- RLS Policies for events table
CREATE POLICY "Users can manage events for their trips" ON public.events
  FOR ALL USING (
    day_id IN (
      SELECT td.id FROM public.trip_days td
      JOIN public.trips t ON td.trip_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

-- RLS Policies for expenses table
CREATE POLICY "Users can manage expenses for their trips" ON public.expenses
  FOR ALL USING (
    day_id IN (
      SELECT td.id FROM public.trip_days td
      JOIN public.trips t ON td.trip_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

-- RLS Policies for packing_items table
CREATE POLICY "Users can manage packing items for their trips" ON public.packing_items
  FOR ALL USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  );

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for trips table to auto-update updated_at
DROP TRIGGER IF EXISTS handle_trips_updated_at ON public.trips;
CREATE TRIGGER handle_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Ensure RLS is enforced for all roles
ALTER TABLE public.trips FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trip_days FORCE ROW LEVEL SECURITY;
ALTER TABLE public.events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.expenses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.packing_items FORCE ROW LEVEL SECURITY;

COMMIT;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Vacation Planner schema migration completed successfully';
END $$;