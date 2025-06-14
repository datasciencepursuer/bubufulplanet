-- Add color field to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT 'purple';

-- Update existing events to have the default color
UPDATE public.events 
SET color = 'purple' 
WHERE color IS NULL;