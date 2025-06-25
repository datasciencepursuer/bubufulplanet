-- First, add nullable columns to expenses table
ALTER TABLE "expenses" 
ADD COLUMN "trip_id" UUID,
ADD COLUMN "owner_id" UUID,
ADD COLUMN "group_id" UUID;

-- Make dayId nullable since expenses can be trip-level
ALTER TABLE "expenses" ALTER COLUMN "day_id" DROP NOT NULL;

-- Create ExpenseParticipant table
CREATE TABLE "expense_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expense_id" UUID NOT NULL,
    "participant_id" UUID,
    "external_name" VARCHAR(255),
    "split_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount_owed" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_participants_pkey" PRIMARY KEY ("id")
);

-- Add indexes for ExpenseParticipant
CREATE INDEX "idx_expense_participants_expense_id" ON "expense_participants"("expense_id");
CREATE INDEX "idx_expense_participants_participant_id" ON "expense_participants"("participant_id");

-- Add unique constraints for ExpenseParticipant
CREATE UNIQUE INDEX "expense_participants_expense_id_participant_id_key" ON "expense_participants"("expense_id", "participant_id");
CREATE UNIQUE INDEX "expense_participants_expense_id_external_name_key" ON "expense_participants"("expense_id", "external_name");

-- Add indexes for expenses
CREATE INDEX "idx_expenses_trip_id" ON "expenses"("trip_id");
CREATE INDEX "idx_expenses_owner_id" ON "expenses"("owner_id");
CREATE INDEX "idx_expenses_group_id" ON "expenses"("group_id");

-- Migrate existing data: Set trip_id based on day_id
UPDATE "expenses" e
SET "trip_id" = (
    SELECT td."trip_id"
    FROM "trip_days" td
    WHERE td."id" = e."day_id"
)
WHERE e."trip_id" IS NULL AND e."day_id" IS NOT NULL;

-- Set group_id based on trip
UPDATE "expenses" e
SET "group_id" = (
    SELECT t."group_id"
    FROM "trips" t
    WHERE t."id" = e."trip_id"
)
WHERE e."group_id" IS NULL AND e."trip_id" IS NOT NULL;

-- Set owner to first group member
UPDATE "expenses" e
SET "owner_id" = (
    SELECT gm."id" 
    FROM "group_members" gm
    WHERE gm."group_id" = e."group_id"
    ORDER BY gm."joined_at"
    LIMIT 1
)
WHERE e."owner_id" IS NULL AND e."group_id" IS NOT NULL;

-- Create even split participants for existing expenses
INSERT INTO "expense_participants" ("expense_id", "participant_id", "split_percentage", "amount_owed")
SELECT 
    e."id",
    gm."id",
    100.0 / COUNT(*) OVER (PARTITION BY e."id"),
    e."amount" / COUNT(*) OVER (PARTITION BY e."id")
FROM "expenses" e
JOIN "group_members" gm ON gm."group_id" = e."group_id"
WHERE e."owner_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "expense_participants" ep 
    WHERE ep."expense_id" = e."id"
);

-- Now make the new columns required
ALTER TABLE "expenses" 
ALTER COLUMN "trip_id" SET NOT NULL,
ALTER COLUMN "owner_id" SET NOT NULL,
ALTER COLUMN "group_id" SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE "expenses" 
ADD CONSTRAINT "expenses_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "expenses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "group_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense_participants" 
ADD CONSTRAINT "expense_participants_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "expense_participants_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "group_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;