-- CreateTable: Add devices table
CREATE TABLE "devices" (
    "fingerprint" VARCHAR(255) NOT NULL,
    "user_agent" TEXT,
    "screen" VARCHAR(100),
    "timezone" VARCHAR(100),
    "language" VARCHAR(20),
    "platform" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("fingerprint")
);

-- Migrate existing device data to devices table
INSERT INTO "devices" ("fingerprint", "user_agent", "created_at", "updated_at")
SELECT DISTINCT 
    "device_fingerprint",
    "user_agent",
    MIN("created_at"),
    CURRENT_TIMESTAMP
FROM "device_sessions"
WHERE "device_fingerprint" IS NOT NULL
GROUP BY "device_fingerprint", "user_agent"
ON CONFLICT ("fingerprint") DO NOTHING;

-- Add new columns to device_sessions with temporary nullable constraints
ALTER TABLE "device_sessions" ADD COLUMN "current_traveler_name" VARCHAR(255);
ALTER TABLE "device_sessions" ADD COLUMN "available_travelers" JSONB;
ALTER TABLE "device_sessions" ADD COLUMN "session_type" VARCHAR(20) DEFAULT 'remember_device';
ALTER TABLE "device_sessions" ADD COLUMN "expires_at" TIMESTAMPTZ(6);
ALTER TABLE "device_sessions" ADD COLUMN "max_idle_time" INTEGER DEFAULT 604800;

-- Populate new columns with existing data
UPDATE "device_sessions" 
SET 
    "current_traveler_name" = "traveler_name",
    "available_travelers" = jsonb_build_array("traveler_name"),
    "expires_at" = "created_at" + INTERVAL '30 days'
WHERE "current_traveler_name" IS NULL;

-- Make required columns NOT NULL after populating
ALTER TABLE "device_sessions" ALTER COLUMN "current_traveler_name" SET NOT NULL;
ALTER TABLE "device_sessions" ALTER COLUMN "expires_at" SET NOT NULL;

-- Remove duplicate sessions (keep most recent per device+group combination)
DELETE FROM "device_sessions" 
WHERE "id" NOT IN (
    SELECT DISTINCT ON ("device_fingerprint", "group_id") "id"
    FROM "device_sessions" 
    ORDER BY "device_fingerprint", "group_id", "last_used" DESC
);

-- Drop any existing policies that depend on traveler_name column
DROP POLICY IF EXISTS "device_sessions_session_access" ON "device_sessions";

-- Drop the old traveler_name column
ALTER TABLE "device_sessions" DROP COLUMN "traveler_name" CASCADE;

-- Add foreign key constraint
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_device_fingerprint_fkey" FOREIGN KEY ("device_fingerprint") REFERENCES "devices"("fingerprint") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add new indexes
CREATE INDEX "idx_device_sessions_expires" ON "device_sessions"("expires_at");
CREATE INDEX "idx_device_sessions_last_used" ON "device_sessions"("last_used");

-- Add unique constraint for device+group combination
CREATE UNIQUE INDEX "unique_device_group_session" ON "device_sessions"("device_fingerprint", "group_id");

-- CreateTable: Add cleanup_log table
CREATE TABLE "cleanup_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "table_name" VARCHAR(100) NOT NULL,
    "deleted_count" INTEGER NOT NULL,
    "details" JSONB,
    "cleaned_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cleanup_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_cleanup_log_table" ON "cleanup_log"("table_name");
CREATE INDEX "idx_cleanup_log_cleaned_at" ON "cleanup_log"("cleaned_at");