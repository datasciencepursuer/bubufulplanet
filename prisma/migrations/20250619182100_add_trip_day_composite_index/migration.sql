-- AlterTable
ALTER TABLE "events" ALTER COLUMN "start_slot" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "idx_trip_days_trip_id_day_number" ON "trip_days"("trip_id", "day_number");
