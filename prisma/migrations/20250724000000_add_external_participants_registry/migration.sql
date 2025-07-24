-- Create ExternalParticipant table for group-level tracking
CREATE TABLE "external_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_participants_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
ALTER TABLE "external_participants" ADD CONSTRAINT "external_participants_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "travel_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique constraint to prevent duplicate names per group
ALTER TABLE "external_participants" ADD CONSTRAINT "external_participants_group_id_name_key" UNIQUE ("group_id", "name");

-- Create indexes for performance
CREATE INDEX "idx_external_participants_group_id" ON "external_participants"("group_id");
CREATE INDEX "idx_external_participants_name" ON "external_participants"("name");
CREATE INDEX "idx_external_participants_last_used" ON "external_participants"("last_used_at");

-- Add external_participant_id column to expense_participants table for referencing
ALTER TABLE "expense_participants" ADD COLUMN "external_participant_id" UUID;

-- Add foreign key constraint for external participant reference
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_external_participant_id_fkey" FOREIGN KEY ("external_participant_id") REFERENCES "external_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for external participant reference
CREATE INDEX "idx_expense_participants_external_participant_id" ON "expense_participants"("external_participant_id");

-- Migrate existing external participants to the new table
INSERT INTO "external_participants" ("group_id", "name", "created_at", "last_used_at")
SELECT DISTINCT 
    e."group_id",
    ep."external_name",
    MIN(ep."created_at") as "created_at",
    MAX(ep."created_at") as "last_used_at"
FROM "expense_participants" ep
JOIN "expenses" e ON e."id" = ep."expense_id"
WHERE ep."external_name" IS NOT NULL 
  AND ep."external_name" != ''
GROUP BY e."group_id", ep."external_name";

-- Update expense_participants to reference the new external_participants table
UPDATE "expense_participants" 
SET "external_participant_id" = ext."id"
FROM "external_participants" ext, "expenses" e
WHERE "expense_participants"."expense_id" = e."id"
  AND "expense_participants"."external_name" = ext."name" 
  AND e."group_id" = ext."group_id"
  AND "expense_participants"."external_name" IS NOT NULL;