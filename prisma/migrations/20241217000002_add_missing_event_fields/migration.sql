-- Add missing event fields that were in the standalone RLS migration
-- These fields are required for the application to work properly

BEGIN;

-- Add missing event fields to match database.ts types and Prisma schema
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3B82F6';

COMMIT;