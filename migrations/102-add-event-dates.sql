-- Migration to add date fields to events table for multi-day event support
-- This allows events to span past midnight

BEGIN;

-- Add start_date and end_date columns to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Migrate existing data: set dates based on the associated trip_day
UPDATE public.events e
SET 
  start_date = td.date,
  end_date = td.date
FROM public.trip_days td
WHERE e.day_id = td.id
AND e.start_date IS NULL;

-- Make start_date NOT NULL after migration
ALTER TABLE public.events 
ALTER COLUMN start_date SET NOT NULL;

-- Create new indexes for date-based queries
CREATE INDEX IF NOT EXISTS idx_events_dates ON public.events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON public.events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_end_date ON public.events(end_date);

-- Update the events table comment
COMMENT ON TABLE public.events IS 'Events can now span multiple days with start_date and end_date fields';
COMMENT ON COLUMN public.events.start_date IS 'The date when the event starts';
COMMENT ON COLUMN public.events.end_date IS 'The date when the event ends (NULL means same as start_date)';
COMMENT ON COLUMN public.events.start_time IS 'The time when the event starts on start_date';
COMMENT ON COLUMN public.events.end_time IS 'The time when the event ends on end_date';

COMMIT;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Event dates migration completed successfully';
END $$;