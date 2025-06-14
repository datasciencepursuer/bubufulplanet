-- Update default color for events table
ALTER TABLE public.events 
ALTER COLUMN color SET DEFAULT '#fbf2c4';

-- Update any existing events that have the old default color
UPDATE public.events 
SET color = '#fbf2c4' 
WHERE color = 'purple';