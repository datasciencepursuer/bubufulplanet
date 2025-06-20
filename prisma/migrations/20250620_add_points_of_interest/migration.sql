-- CreateTable: Add points_of_interest table
CREATE TABLE "points_of_interest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "destination_name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "link" TEXT,
    "group_id" UUID NOT NULL,
    "trip_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_of_interest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_points_of_interest_group_id" ON "points_of_interest"("group_id");
CREATE INDEX "idx_points_of_interest_trip_id" ON "points_of_interest"("trip_id");

-- AddForeignKey
ALTER TABLE "points_of_interest" ADD CONSTRAINT "points_of_interest_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "travel_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "points_of_interest" ADD CONSTRAINT "points_of_interest_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing saved_destinations to points_of_interest table
INSERT INTO "points_of_interest" ("destination_name", "link", "group_id", "created_at", "updated_at")
SELECT 
    COALESCE(dest->>'name', 'Unknown'),
    dest->>'link',
    id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "travel_groups"
CROSS JOIN LATERAL jsonb_array_elements(
    CASE 
        WHEN jsonb_typeof("saved_destinations") = 'array' THEN "saved_destinations"
        ELSE '[]'::jsonb
    END
) AS dest
WHERE "saved_destinations" IS NOT NULL 
    AND jsonb_typeof("saved_destinations") = 'array' 
    AND dest->>'name' IS NOT NULL;

-- AlterTable: Drop saved_destinations column from travel_groups
ALTER TABLE "travel_groups" DROP COLUMN "saved_destinations";