-- CreateMigration: Simplify events to use time slots instead of complex date/time fields

-- Drop the existing time-related indexes
DROP INDEX IF EXISTS "idx_events_time";

-- Drop the existing time and date columns
ALTER TABLE "events" DROP COLUMN IF EXISTS "start_time";
ALTER TABLE "events" DROP COLUMN IF EXISTS "end_time";
ALTER TABLE "events" DROP COLUMN IF EXISTS "start_date";
ALTER TABLE "events" DROP COLUMN IF EXISTS "end_date";

-- Add the new time slot columns
ALTER TABLE "events" ADD COLUMN "start_slot" VARCHAR(5) NOT NULL DEFAULT '09:00';
ALTER TABLE "events" ADD COLUMN "end_slot" VARCHAR(5);

-- Create new index for time slots
CREATE INDEX "idx_events_slots" ON "events"("start_slot", "end_slot");